# Skill 轻量增强 + 工具/MCP 表单行业对齐 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 skill 从纯提示词注入升级为「提示词 + 子工具真实绑定 + SKILL.md 目录导入」，并清理工具/MCP 表单死字段、对齐行业标准。

**Architecture:** 后端在 `agent_pipeline.py` 的 skill 绑定段把 `tool_names` 已存在工具注册为可调用子工具，并把 `script_files` 拼入 instructions；导入接口升级为 multipart 目录上传。前端删除 skill 的 `prompt_id`/`model` 死字段、工具表单的 `model` 死字段，MCP 表单新增 `args`/`env` 字段与 SSE 警告。

**Tech Stack:** FastAPI, SQLAlchemy, Anthropic LangGraph, pyyaml, React/TS, antd, Vitest, pytest

## Global Constraints

- 后端运行无 `--reload`（`make dev-backend`），改代码必须重启后端；日志 `/tmp/backend.log`
- `prompt_id` 列删除用 dev 手动 `ALTER TABLE`，生产需正式迁移（spec §数据模型）
- MCP `sse` 类型值不变（避免 DB 迁移），仅前端显示文案映射为「Streamable HTTP」
- MCP args/env 存储复用现有 `MCPServerDB.config` Text 列，不加新列
- 兼容：MCP endpoint 含内联参数（`shlex.split`）的旧行为保留
- skill 不实现 scripts 原生执行（引导模型走 `execute_python`）
- 测试文件落后于项目，前端测试以真实浏览器验证为主（用户指示）

---

### Task 1: 后端 skill 导入接口升级为 multipart 目录上传

**Files:**
- Modify: `backend/src/routers/skills.py:140-212`（import 路由）
- Modify: `backend/src/repository/skills.py:19-31`（to_dict 加 script_files）
- Modify: `backend/src/orm/content.py:84-87`（RegisteredSkillDB 加 script_files 列）
- Test: `backend/tests/routers/test_routers_skills.py`

**Interfaces:**
- Consumes: 现有 `repo_create_skill(data: dict)`, `log_audit(kind, resource, name, detail)`, `error_response(code, detail)`
- Produces:
  - `POST /api/skills/import` 接受 multipart：文件字段名为相对路径（`SKILL.md`、`scripts/recalc.py`）
  - 响应含 `script_files: dict[str,str]`
  - ORM 新增列 `script_files: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)`
  - `SkillRepository.to_dict` 返回 `script_files`

- [ ] **Step 1: 加 script_files 列到 ORM**

```python
# backend/src/orm/content.py — RegisteredSkillDB 中 prompt_id 行后加
    script_files: Mapped[dict[str, Any] | list[Any] | None] = mapped_column(JSON, nullable=True)
```

- [ ] **Step 2: 更新 repository to_dict**

```python
# backend/src/repository/skills.py to_dict 中加
            "script_files": obj.script_files or {},
```

- [ ] **Step 3: 改 import 路由为 multipart + 写单测**

```python
# backend/src/routers/skills.py 顶部 import 区加
from fastapi import UploadFile, File

@router.post("/api/skills/import")
async def import_skill(files: list[UploadFile] = File(...), category: str = Form("导入")) -> Any:
    """Import a skill from Anthropic Agent Skills SKILL.md directory (multipart).

    Files are keyed by relative path: ``SKILL.md`` (required), ``scripts/*``,
    ``references/*``, ``resources/*`` (optional).  ``SKILL.md`` 的 frontmatter 与
    正文解析逻辑沿用原实现；其余文件内容存入 ``script_files``。
    """
    try:
        import yaml
        contents: dict[str, str] = {}
        for f in files:
            raw = await f.read()
            contents[f.filename or f.name] = raw.decode("utf-8", errors="replace")

        markdown = contents.pop("SKILL.md", "") or contents.pop("skill.md", "")
        if not markdown:
            raise error_response(ErrorCode.INVALID_REQUEST, detail="缺少 SKILL.md 文件")

        meta: dict[str, Any] = {}
        body = markdown
        if markdown.startswith("---"):
            end = markdown.find("\n---", 3)
            if end != -1:
                raw_meta = markdown[3:end].strip()
                body = markdown[end + 4:].lstrip("\n")
                try:
                    parsed = yaml.safe_load(raw_meta)
                    if isinstance(parsed, dict):
                        meta = parsed
                except Exception:
                    meta = {}

        name = str(meta.get("name") or "").strip()
        if not name:
            import re
            m = re.match(r"^#\s+(.+)", body)
            name = m.group(1).strip() if m else "imported-skill"
        name = name[:64]

        description = str(meta.get("description") or "").strip()[:500]
        category = str(meta.get("metadata", {}).get("category") or category)[:32]
        author = str(meta.get("metadata", {}).get("author") or "")[:64]
        license_text = str(meta.get("license") or "").strip()

        tools = meta.get("allowed-tools") or meta.get("allowed_tools") or []
        if not isinstance(tools, list):
            tools = []
        tool_names = [str(x) for x in tools if x]

        instructions = body.strip()
        if not instructions:
            raise error_response(
                ErrorCode.INVALID_REQUEST, detail="SKILL.md 缺少正文，无法导入"
            )
        if license_text:
            instructions += f"\n\n## License\n{license_text}"

        data = {
            "name": name,
            "category": category,
            "content": description,
            "instructions": instructions,
            "tool_names": tool_names,
            "version": "v1.0.0",
            "author": author,
            "status": "active",
            "output_constraint": "",
            "script_files": contents,
        }
        s = await repo_create_skill(data)
        await log_audit("create", "skill", s.name, "导入成功")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "instructions": s.instructions,
            "tool_names": s.tool_names,
            "script_files": s.script_files,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Skill import failed: %s", e, exc_info=True)
        raise error_response(ErrorCode.INTERNAL_ERROR, detail=f"导入失败: {e}") from e
```

```python
# backend/tests/routers/test_routers_skills.py — 新增单测
import io
import pytest

async def test_import_skill_directory_upload(client):
    sk = (
        "---\nname: 网络搜索\ndescription: 执行网络搜索\nallowed-tools:\n  - web_search\n"
        "metadata:\n  category: 信息检索\n  author: odyssey\n---\n\n# 用法\n\n搜索时调用 web_search\n"
    )
    rec = "import requests\ndef search(q):\n    return requests.get('https://x', params={'q': q}).json()\n"
    resp = await client.post(
        "/api/skills/import",
        data={"category": "导入"},
        files=[
            ("files", ("SKILL.md", io.BytesIO(sk.encode()), "text/markdown")),
            ("files", ("scripts/search.py", io.BytesIO(rec.encode()), "text/x-python")),
        ],
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "网络搜索"
    assert body["tool_names"] == ["web_search"]
    assert "scripts/search.py" in (body["script_files"] or {})

async def test_import_skill_missing_skillmd_400(client):
    resp = await client.post(
        "/api/skills/import",
        data={"category": "导入"},
        files=[("files", ("readme.txt", io.BytesIO(b"hi"), "text/plain"))],
    )
    assert resp.status_code == 400
```

- [ ] **Step 4: 兼容旧纯文本导入（若需保留 markdown 字段则加第二端点）**

> 决策：为兼容前端「粘贴」tab，保留 `markdown` 字段支持。将原 `SkillImportRequest` 路由改名
> `POST /api/skills/import-text`，multipart 路由保持 `/api/skills/import`。

```python
# 原 import 路由整体保留，改名:
@router.post("/api/skills/import-text")
async def import_skill_text(req: SkillImportRequest) -> Any:
    # ... 原实现不变（含 output_constraint: "" 修复）
```

- [ ] **Step 5: 重启后端并 curl 实测**

```bash
make dev-backend
curl -s -X POST http://localhost:8081/api/skills/import \
  -F "files=@/tmp/opencode/SKILL.md;filename=SKILL.md" \
  -F "files=@/tmp/opencode/search.py;filename=scripts/search.py"
```
Expected: JSON 含 `script_files` 且 key 为 `scripts/search.py`

- [ ] **Step 6: 跑测试 + 提交**

```bash
cd backend && PYTHONPATH=src python3 -m pytest tests/routers/test_routers_skills.py -q
git add backend/src/orm/content.py backend/src/repository/skills.py backend/src/routers/skills.py backend/tests/routers/test_routers_skills.py
git commit -m "feat(skills): multipart 目录导入 + script_files 存储"
```

---

### Task 2: 运行时 skill 子工具注册 + script_files 注入

**Files:**
- Modify: `backend/src/tasks/agent_pipeline.py:235-257`（Bind skills 段）
- Test: `backend/tests/tasks/test_agent_pipeline.py`（若存在）或新增

**Interfaces:**
- Consumes: `get_skills()` 返回含 `script_files` 的 dict；`registered_tools` 列表（现有 `tool_configs` 构建上下文可拿到）
- Produces: 绑定 skill 时对 `tool_names` 中已存在工具追加 `ToolConfig`；instructions 含「参考脚本」段落

- [ ] **Step 1: 写单测验证子工具注册 + script_files 注入**

> 决策：agent_pipeline 绑定函数内部逻辑复杂（依赖 agent_configs/mcps/tools 多处注入），
> 单测 patch 成本高。改为在 Task 9 端到端验证（导入 skill → 绑定 → 真实 run 断言 instructions
> 含「参考脚本」且子工具可调用）。本任务以代码实现 + 真实 run 验证为主。

- [ ] **Step 2: 实现子工具注册 + script_files 注入**

```python
# backend/src/tasks/agent_pipeline.py — Bind skills 段改写
        all_skills = await get_skills()
        # 已注册工具表（含 builtin），用于 skill 子工具真实绑定
        all_registered_tools = await get_tools()  # 若已有类似调用则复用
        for item in _parse_json_field(ac.skills):
            name = item.get("name", "")
            if name:
                skill_match = next((s for s in all_skills if s.name == name), None)
                if skill_match:
                    script_files = getattr(skill_match, "script_files", None) or {}
                    parts: list[str] = []
                    if skill_match.instructions:
                        parts.append(skill_match.instructions)
                    if skill_match.output_constraint:
                        parts.append(f"输出约束：\n{skill_match.output_constraint}")
                    if skill_match.tool_names:
                        parts.append(f"可用的工具：{', '.join(skill_match.tool_names)}")
                    if script_files:
                        ref_blocks = [
                            f"### {path}\n```\n{content}\n```"
                            for path, content in script_files.items()
                        ]
                        parts.append("## 参考脚本（按需用 execute_python 复现其逻辑）\n" + "\n".join(ref_blocks))
                    skill_instructions = "\n\n".join(filter(None, parts))

                    # 子工具真实注册：tool_names 中已存在的工具生成 ToolConfig
                    for tname in (skill_match.tool_names or []):
                        tmatch = next((t for t in all_registered_tools if t.name == tname), None)
                        if tmatch:
                            params = {}
                            if getattr(tmatch, "parameters", None):
                                try:
                                    import json as _json
                                    params = _json.loads(tmatch.parameters) if isinstance(tmatch.parameters, str) else (tmatch.parameters or {})
                                except Exception:
                                    params = {}
                            tool_configs.append(ToolConfig(
                                name=tname,
                                description=tmatch.description or tname,
                                parameters=params or {"type": "object"},
                            ))

                    tool_configs.append(
                        ToolConfig(
                            name=f"skill_{name}",
                            description=f"{skill_match.content or skill_match.name}。当用户请求与该能力相关时调用此技能。",
                            instructions=skill_instructions,
                            parameters={"type": "object"},
                            endpoint="",
                            method="GET",
                            headers="{}",
                        )
                    )
```

> 注意：需确认 `get_tools` 或等价函数已 import；若没有，从 `repository` import `get_tools`。
> 若 `get_tools` 返回 dict 而非对象，`t.name` 改为 `t.get("name")`。

- [ ] **Step 3: 真实 run 验证**

```bash
# 用 Task 1 导入的 skill 绑定到 agent，发起会话请求让模型按参考脚本生成 xlsx
# 检查最终消息含 [📥 ...] 下载链接且 xlsx 附件可下载
```

- [ ] **Step 4: 跑测试 + 提交**

```bash
cd backend && PYTHONPATH=src python3 -m pytest tests/tasks -q
git add backend/src/tasks/agent_pipeline.py backend/tests/tasks
git commit -m "feat(skills): 运行时子工具注册 + script_files 注入 instructions"
```

---

### Task 3: 后端删除 prompt_id 列

**Files:**
- Modify: `backend/src/orm/content.py:85`（删 prompt_id）
- Modify: `backend/src/repository/skills.py:27`（删 prompt_id）
- Modify: `backend/src/routers/skills.py:26,39,78,128,232`（删 prompt_id 字段）
- Test: `backend/tests/routers/test_routers_skills.py`

**Interfaces:**
- Consumes: 无
- Produces: skill 的 API 响应/请求不再含 `prompt_id`；前端据此移除字段

- [ ] **Step 1: 删 ORM / repo / router 中 prompt_id 引用**

```python
# orm/content.py RegisteredSkillDB 删
    prompt_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
# repository/skills.py to_dict 删
            "prompt_id": obj.prompt_id,
# routers/skills.py SkillCreate/SkillUpdate 删 prompt_id 字段；响应 dict 删 prompt_id
```

- [ ] **Step 2: 执行 dev 迁移**

```bash
# 连接 dev 库删除列（用项目现成 psql/sqlalchemy 方式）
# 例: PGPASSWORD=... psql -h localhost -U <user> <db> -c "ALTER TABLE registered_skills DROP COLUMN prompt_id;"
# 或写一次性脚本 backend/scripts/drop_prompt_id.py 用 session.execute(text(...))
```

- [ ] **Step 3: 跑测试 + 提交**

```bash
cd backend && PYTHONPATH=src python3 -m pytest tests/routers/test_routers_skills.py -q
git add backend/src/orm/content.py backend/src/repository/skills.py backend/src/routers/skills.py
git commit -m "refactor(skills): 删除死字段 prompt_id"
```

---

### Task 4: 前端 skill 删 model/prompt_id 死字段

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/skill/skill.types.ts`
- Modify: `frontend/src/components/AgentStudio/workstation/skill/api.ts`
- Modify: `frontend/src/components/AgentStudio/workstation/skill/useSkillManagement.ts:36-38`（emptyForm）
- Modify: `frontend/src/components/AgentStudio/workstation/skill/SkillFormModal.tsx`（删模型下拉、prompt picker）
- Modify: `frontend/src/components/AgentStudio/workstation/skill/validate.ts`（EMPTY_FORM 删 model）
- Modify: `frontend/src/components/AgentStudio/workstation/skill/SkillManagement.tsx:34`（handleImport 删 prompt_id）
- Test: `frontend/src/components/AgentStudio/workstation/skill/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: Task 3 后端已删 prompt_id
- Produces: `SkillEntry`/`SkillFormData` 无 `model`/`prompt_id` 字段；`SkillFormModal` 无模型下拉与 prompt 选择器

- [ ] **Step 1: 改类型**

```typescript
// skill.types.ts
export interface SkillEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'installed' | 'available';
  version: string;
  author: string;
  instructions: string;
  tool_names: string[];
  output_constraint: string;
  createdAt: string;
}
```

- [ ] **Step 2: 改 api.ts**（toEntry 删 model/prompt_id；create/update 删对应字段；clone 删 model）

```typescript
// api.ts toEntry 签名与映射删除 model、prompt_id
function toEntry(item: { id: string; name: string; description: string; category: string; version: string; status: string; author: string; instructions: string; tool_names: unknown; output_constraint: string; created_at: string }): SkillEntry {
  return {
    id: item.id, name: item.name, description: item.description, category: item.category,
    status: (item.status === 'installed' || item.status === 'available') ? item.status : 'installed',
    version: item.version, author: item.author, instructions: item.instructions || '',
    tool_names: Array.isArray(item.tool_names) ? item.tool_names : [],
    output_constraint: item.output_constraint || '',
    createdAt: item.created_at.slice(0, 10),
  };
}
```

- [ ] **Step 3: 改 useSkillManagement emptyForm 与 SkillFormModal**（删 model 下拉与 prompt picker、相关 useEffect fetch('/api/prompts') 分支）

```typescript
// useSkillManagement.ts emptyForm 删 model、prompt_id 行
// SkillFormModal.tsx: 删 useModelOptions、prompts state、selectedPrompt、activePicker 'prompt' 分支、
//   ResourcePickerModal prompt 渲染块（line 200-211 附近）；grid 从 grid-cols-2 改 grid-cols-3 或调整
```

- [ ] **Step 4: 改 SkillManagement.handleImport 删 prompt_id**，改 validate EMPTY_FORM

```typescript
// SkillManagement.tsx handleImport 删: prompt_id: item.prompt_id || '',
// validate.ts EMPTY_FORM 删 model: 'GPT-4o',
```

- [ ] **Step 5: 跑前端 build/typecheck + 相关测试**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```
Expected: 无 `prompt_id`/`model` 相关 skill 类型错误（测试文件内的引用一并清理）

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/AgentStudio/workstation/skill
git commit -m "refactor(skills): 前端删除死字段 model/prompt_id"
```

---

### Task 5: 前端 skill 导入 UI（目录上传 + 粘贴 tab）

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/skill/SkillManagement.tsx:88-110,162-190`（导入按钮与 Modal）
- Modify: `frontend/src/api/client/skills.ts`（新增 importSkillDirectory + importSkillFromMarkdown 改调 /import-text）
- Modify: `frontend/src/i18n/locales/{zh-CN,en-US}/workstation.json`（skill 命名空间上传文案）
- Test: 无（测试文件落后，手动验证）

**Interfaces:**
- Consumes: 后端 Task 1 的 `/api/skills/import`（multipart）+ `/api/skills/import-text`
- Produces: `importSkillDirectory(fileList: File[])` → multipart FormData；弹窗内 `Tabs`（上传/粘贴）

- [ ] **Step 1: api/client/skills.ts 新增目录导入函数**

```typescript
export async function importSkillDirectory(files: File[], category = '导入'): Promise<SkillItem> {
  const form = new FormData();
  form.append('category', category);
  for (const f of files) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
  const { data } = await api.post('/skills/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
```

- [ ] **Step 2: 改 importSkillFromMarkdown 指向 /import-text**

```typescript
export async function importSkillFromMarkdown(markdown: string, category = '导入'): Promise<SkillItem> {
  const { data } = await api.post('/skills/import-text', { markdown, category });
  return data;
}
```

- [ ] **Step 3: SkillManagement 导入 Modal 加 Tabs（上传目录 + 粘贴文本）**

```tsx
// SkillManagement.tsx 导入 Modal 内改为 antd Tabs:
import { Tabs } from 'antd';
// items:
// 1) 上传: <Upload.Dragger multiple directory={false} beforeUpload={() => false}
//     onChange={({ fileList }) => setImportFiles(fileList.map(f => f.originFileObj).filter(Boolean) as File[])}>
//     <p><Upload size={20} /></p><p>选择 SKILL.md 目录或文件（含 scripts/references）</p></Upload.Dragger>
// 2) 粘贴: <Input.TextArea value={importText} onChange={...} placeholder="---\nname: my-skill\n..." />
// okButtonProps disabled: (activeTab==='upload' ? importFiles.length===0 : !importText.trim())
// handleImport: 若 activeTab==='upload' → d.batchAdd([await importSkillDirectory(importFiles)])
//   否则 → d.batchAdd([await importSkillFromMarkdown(importText)])
```

> 目录选择需 `<input webkitdirectory>`；antd Upload.Dragger 默认不支持目录，用原生 input + webkitdirectory
> 或说明「多选文件（保持相对路径由文件名 key 表达）」。为 ponytail 简单起见：**多文件选择**，每个文件名
> 即相对路径 key（`scripts/recalc.py` 需用户在文件名中带路径，或直接用 `Upload` 的 `webkitdirectory`）。

- [ ] **Step 4: i18n 文案**（zh-CN/en-US 各加 import_upload_tab / import_paste_tab / import_hint / import_success）

- [ ] **Step 5: 浏览器验证**（用官方 anthropics/skills/xlsx 目录实测）

```bash
make dev-backend
# 浏览器：技能管理页 → 导入 SKILL.md → 上传 tab 选 xlsx 目录 → 导入 → 列表出现 xlsx
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/api/client/skills.ts frontend/src/components/AgentStudio/workstation/skill/SkillManagement.tsx frontend/src/i18n/locales
git commit -m "feat(skills): 前端目录上传导入 + 粘贴 tab"
```

---

### Task 6: 前端工具表单删除 model 死字段

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/tool/tool.types.ts:8`（删 model）
- Modify: `frontend/src/components/AgentStudio/workstation/tool/ToolFormModal.tsx:19,70-74`（删 useModelOptions 与模型下拉）
- Modify: `frontend/src/components/AgentStudio/workstation/tool/api.ts`（删 model 透传）
- Modify: `frontend/src/components/AgentStudio/workstation/tool/validate.ts`（EMPTY_FORM 删 model）
- Test: `frontend/src/components/AgentStudio/workstation/tool/__tests__/validate.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `ToolEntry`/`ToolFormData` 无 model；表单无模型下拉

- [ ] **Step 1: 删类型 + 表单 + api + validate 中 model 引用**

```typescript
// tool.types.ts ToolEntry 删 model: string; 行
// ToolFormModal.tsx 删 import useModelOptions、删 model 下拉 select 块，category 从 flex-1 变整行或保留布局
// api.ts toEntry/ create/ update/ clone 删 model 相关
// validate.ts EMPTY_FORM 删 model: 'GPT-4o',
```

> 后端 `RegisteredToolDB.model` 列保留（db 不动），仅前端不再读写。

- [ ] **Step 2: typecheck + 测试 + 提交**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
cd frontend && npx vitest run src/components/AgentStudio/workstation/tool/__tests__/validate.test.ts 2>&1 | tail -3
git add frontend/src/components/AgentStudio/workstation/tool
git commit -m "refactor(tools): 删除死字段 model"
```

---

### Task 7: 前端 MCP 表单新增 args/env 字段 + SSE 警告

**Files:**
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/mcp.types.ts`（MCPEntry/MCPFormData 加 args/env）
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/mcp.constants.ts`（sse 显示文案）
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/MCPFormModal.tsx`（args/env 输入 + SSE 警告）
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/validate.ts`（EMPTY_FORM 加 args/env）
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/api.ts`（config 透传 args/env）
- Modify: `frontend/src/components/AgentStudio/workstation/mcp/locales.ts`（如需新文案）
- Test: `frontend/src/components/AgentStudio/workstation/mcp/__tests__/MCPFormModal.test.tsx`（手动为主）

**Interfaces:**
- Consumes: 后端 MCP config 字段（现支持任意 JSON）
- Produces: `MCPFormData.args: string[]`、`MCPFormData.env: string[]`（每行一个 `KEY=VALUE` 或参数）；api 将 args/env 写入 config JSON

- [ ] **Step 1: 类型加 args/env**

```typescript
// mcp.types.ts
export interface MCPEntry {
  id: string; name: string; description: string;
  type: 'stdio' | 'sse';
  status: 'connected' | 'disconnected' | 'error';
  version: string; command: string; url: string;
  args: string[];
  env: string[];
  createdAt: string;
}
```

- [ ] **Step 2: validate EMPTY_FORM 加 args/env**

```typescript
// validate.ts
export const EMPTY_FORM: MCPFormData = {
  name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0',
  command: '', url: '', args: [], env: [],
};
```

- [ ] **Step 3: MCPFormModal 加字段 + 警告**

```tsx
// stdio 时 command 输入框下方加:
//   <label>{t('mcp.form_args')}</label>
//   <textarea value={formData.args.join('\n')}
//     onChange={(e) => setFormData(f => ({ ...f, args: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
//     placeholder="-y
// @modelcontextprotocol/server-brave-search" rows={2} />
//   <label>{t('mcp.form_env')}</label>
//   <textarea value={formData.env.join('\n')}
//     onChange={(e) => setFormData(f => ({ ...f, env: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) }))}
//     placeholder="BRAVE_API_KEY=xxx" rows={2} />
// sse 类型时表单顶部显示警告:
//   {formData.type === 'sse' && (
//     <div className="p-2 text-xs rounded-md bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[var(--color-warning)]">
//       {t('mcp.sse_warning')}
//     </div>
//   )}
// mcp.constants.ts: MCP_TYPE_OPTIONS 保留 ['stdio','sse']，MCP_TYPE_LABEL = { stdio: 'stdio', sse: 'Streamable HTTP' }，select 用 label
```

- [ ] **Step 4: api.ts config 透传 args/env**

```typescript
// toEntry 从 parseConfig 读 args/env
  const cfg = parseConfig(item.config);
  ...
  args: Array.isArray(cfg.args) ? cfg.args as string[] : [],
  env: Array.isArray(cfg.env) ? cfg.env as string[] : [],
// create/update/clone 的 config JSON 加 args/env:
      config: JSON.stringify({ description: data.description, version: data.version, args: data.args, env: data.env }),
```

- [ ] **Step 5: 浏览器验证 + 提交**

```bash
# 浏览器：MCP 管理页 → 新增 → stdio 填 command+args+env → 保存 → 测试按钮
git add frontend/src/components/AgentStudio/workstation/mcp
git commit -m "feat(mcp): 表单支持 args/env + Streamable HTTP 叫法 + SSE 警告"
```

---

### Task 8: 后端 MCP stdio 运行时读取 config 的 args/env

**Files:**
- Modify: `backend/src/tasks/agent_pipeline.py:195-207`（构建 stdio MCP 时把 args/env 写入 ToolConfig）
- Modify: `backend/src/services/tool_config.py:24-27`（ToolConfig/_ToolWrapper 加 mcp_config 字段）
- Modify: `backend/src/services/tool_handlers.py:283,304`（call_mcp_sdk 用 mcp_config 替代 shlex.split）
- Modify: `backend/src/tasks/pipeline_utils.py:134-136`（_discover_mcp_tools 支持 args/env）
- Test: `backend/tests/services/test_tool_handlers.py`

**Interfaces:**
- Consumes: Task 7 前端写入的 config JSON（`{"args": [...], "env": [...]}`）
- Produces: `ToolConfig.mcp_config: dict`；`call_mcp_sdk`/`_discover_mcp_tools` 构造 `StdioServerParameters(command, args, env)`

- [ ] **Step 1: ToolConfig/_ToolWrapper 加 mcp_config**

```python
# tool_config.py dataclass 加
    mcp_config: dict[str, Any] | None = None
# _ToolWrapper.__init__ 加参数与 self.mcp_config = mcp_config
# build_tool_definition 透传 mcp_config=tc.mcp_config
```

- [ ] **Step 2: agent_pipeline 传 args/env**

```python
# agent_pipeline.py stdio 分支 ToolConfig(...) 加
                            mcp_config=mcp_params,   # mcp_params 现含 description/version/args/env
# 同时 _discover_mcp_tools 传入 args/env:
                        sub_tools = await _discover_mcp_tools(
                            mcp_endpoint,
                            args=mcp_params.get("args") if isinstance(mcp_params, dict) else None,
                            env=mcp_params.get("env") if isinstance(mcp_params, dict) else None,
                        )
```

- [ ] **Step 3: call_mcp_sdk 用 mcp_config**

```python
# tool_handlers.py call_mcp_sdk 中两处 StdioServerParameters 构造改为:
    def _mcp_params(tool_self):
        cfg = tool_self.mcp_config or {}
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except Exception:
                cfg = {}
        args = cfg.get("args") or []
        env = cfg.get("env") or {}
        # 兼容旧行为: endpoint 含内联参数
        if not args:
            cmd = shlex.split(tool_self.mcp_endpoint)
            return StdioServerParameters(command=cmd[0], args=cmd[1:], env=env or None)
        return StdioServerParameters(command=tool_self.mcp_endpoint, args=args, env=env or None)
```

> 注意：stdio MCP 的 `tool_self.mcp_endpoint` 运行时是 `exec_stdio_mcp.__name__`（方法 MCP 被覆盖），
> 而真实 command 由 `mcp_config` 携带。此步需在 agent_pipeline 构建 ToolConfig 时把真实 endpoint
> （`mcp_endpoint` 变量）放入 `mcp_config["command"]`，`call_mcp_sdk` 读取之。

```python
# agent_pipeline stdio 分支调整:
                            mcp_config={
                                **mcp_params,
                                "command": mcp_endpoint,
                            },
```

```python
# call_mcp_sdk._mcp_params 最终:
    def _mcp_params(tool_self):
        cfg = tool_self.mcp_config or {}
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except Exception:
                cfg = {}
        cmd = cfg.get("command") or tool_self.mcp_endpoint
        args = cfg.get("args") or []
        env = cfg.get("env") or {}
        if args:
            return StdioServerParameters(command=cmd, args=args, env=env or None)
        cmd_parts = shlex.split(cmd)
        return StdioServerParameters(command=cmd_parts[0], args=cmd_parts[1:], env=env or None)
```

- [ ] **Step 4: _discover_mcp_tools 支持 args/env**

```python
# pipeline_utils.py
async def _discover_mcp_tools(endpoint: str, args: list[str] | None = None, env: dict[str, str] | None = None) -> list[dict[str, Any]]:
    if args:
        params = StdioServerParameters(command=endpoint, args=args, env=env or None)
    else:
        cmd = shlex.split(endpoint)
        params = StdioServerParameters(command=cmd[0], args=cmd[1:], env=env or None)
```

- [ ] **Step 5: 跑测试 + 重启 + 提交**

```bash
cd backend && PYTHONPATH=src python3 -m pytest tests/services/test_tool_handlers.py tests/routers/test_routers_mcps.py -q
make dev-backend
git add backend/src/services/tool_config.py backend/src/services/tool_handlers.py backend/src/tasks/agent_pipeline.py backend/src/tasks/pipeline_utils.py
git commit -m "feat(mcp): 运行时读取 config args/env 构造 StdioServerParameters"
```

---

### Task 9: 端到端手动验证 + 清理

**Files:** 无

- [ ] **Step 1: 用官方 xlsx skill 实测完整链路**

```bash
# 1) 下载 anthropics/skills 的 xlsx 目录（SKILL.md + scripts/*）
# 2) 前端导入 → 列表出现 xlsx
# 3) agent 绑定 xlsx skill
# 4) 对话: "生成一个带 SUM 公式的销售报表 xlsx"
# 5) 验证: 最终消息含 [📥 ...] 链接，下载 xlsx 可用
```

- [ ] **Step 2: MCP 带 args/env 实测**

```bash
# 新增 stdio MCP: command=npx, args=-y @modelcontextprotocol/server-everything, env 空
# 测试按钮成功 → agent 绑定 → 会话调用其工具
```

- [ ] **Step 3: 确认 prompt_id/model 全消失**

```bash
grep -rn "prompt_id" backend/src frontend/src --include="*.py" --include="*.ts" --include="*.tsx" | grep -v tests | head
# Expected: 无 skill 相关 prompt_id（prompts.py 的 prompt_id 路由参数除外）
grep -rn "model" frontend/src/components/AgentStudio/workstation/tool frontend/src/components/AgentStudio/workstation/skill | head
# Expected: 无残留
```

- [ ] **Step 4: 全量后端测试**

```bash
cd backend && PYTHONPATH=src python3 -m pytest tests/routers/test_routers_skills.py tests/routers/test_routers_mcps.py tests/services/test_tool_handlers.py -q
```

- [ ] **Step 5: 提交收尾（若有未提交改动）**

```bash
git status
git commit -am "chore: skill 轻量增强 + 工具/MCP 表单对齐收尾" || true
```
