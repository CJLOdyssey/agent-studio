# 移除内置硬编码工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除平台全部内置硬编码工具（web_search / fetch_page / calculator / execute_python / open_user_browser），保留 registry 框架与 MCP/Skill/HTTP 分发等通用功能，所有能力由用户在前端添加。

**Architecture:** 删除 `thinking_tree/tools/` 三个自注册插件文件；删除 `seed.py` 静态内置种子；删除 `tool_config.py` 与 `tool_handlers.py` 中按名字硬编码的分支与 handler；保留 registry 框架、MCP/Skill/HTTP 分发、llm_fallback。用一次性迁移脚本清理数据库存量数据（registered_tools 内置行、agent 工具绑定、skill tool_names），同步更新测试。

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy async / pytest / psql

**Spec:** `docs/superpowers/specs/2026-08-01-remove-builtin-tools-design.md`

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `backend/src/thinking_tree/tools/tavily_search.py` | 删除 | web_search 插件 |
| `backend/src/thinking_tree/tools/fetch_page.py` | 删除 | fetch_page 插件 |
| `backend/src/thinking_tree/tools/calculator.py` | 删除 | calculator 插件 |
| `backend/src/core/seed.py` | 修改 | 删 static_builtins，保留 registry 同步 |
| `backend/src/services/tool_config.py` | 修改 | 删 execute_python / open_user_browser 分支 |
| `backend/src/services/tool_handlers.py` | 修改 | 删两个 handler + 相关 imports/常量 |
| `scripts/remove_builtin_tools.py` | 新建 | 一次性数据迁移 |
| 6 个测试文件 | 修改 | 删/改内置工具用例 |

---

### Task 1: 删除三个 registry 插件文件

**Files:**
- Delete: `backend/src/thinking_tree/tools/tavily_search.py`
- Delete: `backend/src/thinking_tree/tools/fetch_page.py`
- Delete: `backend/src/thinking_tree/tools/calculator.py`

- [ ] **Step 1: 删除文件**

```bash
git rm backend/src/thinking_tree/tools/tavily_search.py \
      backend/src/thinking_tree/tools/fetch_page.py \
      backend/src/thinking_tree/tools/calculator.py
```

保留 `thinking_tree/tools/__init__.py`（自动发现逻辑，目录无模块时无操作）和 `thinking_tree/registry.py`（框架）。

- [ ] **Step 2: 验证无残留导入**

```bash
cd backend && PYTHONPATH=src python -c "import thinking_tree.tools; from thinking_tree.registry import registry; print('plugins:', registry.list_plugins())"
```

Expected: `plugins: []`

- [ ] **Step 3: 跑现有测试确认失败点（预期）**

```bash
cd backend && PYTHONPATH=src python -m pytest tests/graph/test_agent_graph.py -x -q 2>&1 | tail -5
```

Expected: FAIL（graph 测试仍引用 web_search/calculator——Task 5 修复）

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: remove builtin thinking-tree tool plugins (web_search/fetch_page/calculator)"
```

---

### Task 2: seed.py 删除 static_builtins

**Files:**
- Modify: `backend/src/core/seed.py:75-132`

- [ ] **Step 1: 删除 static_builtins 段**

删除 `backend/src/core/seed.py` 第 75-132 行——从注释 `# Host primitives dispatched by name...` 开始到 `for b in static_builtins:` 循环结束（含 execute_python 与 open_user_browser 两个条目）。保留：
- 第 42-73 行（registry 插件同步逻辑）
- 第 133 行 `await session.commit()`

修改后函数应为：

```python
async def seed_builtin_tools() -> None:
    """Sync registered plugins from ToolRegistry into registered_tools table."""
    import json
    from sqlalchemy import select
    from core.infra.database import get_session_factory
    from orm import RegisteredToolDB
    import thinking_tree.tools  # noqa: F401 — triggers registration
    from thinking_tree.registry import registry

    factory = get_session_factory()
    plugins = registry.list_plugins()
    async with factory() as session:
        for p in plugins:
            name = p["tool_name"]
            result = await session.execute(
                select(RegisteredToolDB).where(
                    RegisteredToolDB.name == name,
                    RegisteredToolDB.is_builtin == True,
                )
            )
            if result.scalar_one_or_none():
                continue
            tool = RegisteredToolDB(
                name=name,
                category="builtin",
                description=p.get("description", ""),
                status="active",
                version="v1.0.0",
                parameters=json.dumps(p.get("config_schema") or {"type": "object", "properties": {}}),
                is_builtin=True,
            )
            session.add(tool)
        await session.commit()
```

- [ ] **Step 2: 语法验证**

```bash
cd backend && PYTHONPATH=src python -c "import core.seed; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/src/core/seed.py && git commit -m "refactor: stop seeding builtin tools (execute_python/open_user_browser)"
```

---

### Task 3: tool_config.py 删除硬编码名字分支

**Files:**
- Modify: `backend/src/services/tool_config.py`

- [ ] **Step 1: 删除 `_resolve_handler()` 中 execute_python 分支**

删除 `backend/src/services/tool_config.py` 中 `_resolve_handler()` 内这两行（约 94-95）：

```python
        if self.name == "execute_python":
            return "code"
```

修改后 `_resolve_handler()` 不再返回 `"code"`：

```python
    def _resolve_handler(self) -> str | None:
        """Resolve handler discriminator from tool config fields.

        Returns 'mcp', 'http', 'skill', or None if no match.
        """
        if self.mcp_type or self.mcp_endpoint:
            return "mcp"
        if self.endpoint and self.endpoint.startswith(("http://", "https://")):
            return "http"
        # Skill tools are bound as skill_<name>; route by prefix so an
        # unconfigured skill (empty instructions) gets a clear message from
        # handle_skill instead of silently falling through to llm_fallback.
        if self.instructions or self.name.startswith("skill_"):
            return "skill"
        return None
```

- [ ] **Step 2: 删除 `invoke()` 中 open_user_browser 分支与 code 分发**

删除 `invoke()` 中以下片段（约 117-120）：

```python
        # 2) User-browser opener — publishes open_url event to frontend via WebSocket
        if self.name.startswith("open_user_browser"):
            from services.tool_handlers import handle_open_browser
            return await handle_open_browser(self, args)
```

并将 `# 3) Field-based handler` 注释改为 `# 2) Field-based handler`，同时从 import 中移除 `handle_open_browser`。

删除 field-based 分发中的 code 分支（约 136）：

```python
        if kind == "code":
            return await handle_execute_python(self, args)
```

并将 import 语句（约 123-128）改为：

```python
        # 2) Field-based handler
        from services.tool_handlers import (
            call_http_endpoint,
            handle_mcp,
            handle_skill,
        )
```

修改后 `invoke()` 流程为：registry 分发 → field-based（mcp/http/skill）→ llm_fallback。

- [ ] **Step 3: 语法验证 + 确认无 execute_python/open_user_browser 残留**

```bash
cd backend && PYTHONPATH=src python -c "import services.tool_config; print('ok')"
grep -n "execute_python\|open_user_browser" backend/src/services/tool_config.py
```

Expected: `ok`；grep 无输出

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/tool_config.py && git commit -m "refactor: drop hardcoded execute_python/open_user_browser dispatch"
```

---

### Task 4: tool_handlers.py 删除两个 handler

**Files:**
- Modify: `backend/src/services/tool_handlers.py`

- [ ] **Step 1: 删除 handler 与常量**

删除以下内容：
1. 第 47-49 行模块中部 import 块：`import os` / `import tempfile` / `import traceback`
2. 第 51-66 行常量：`_AGENT_WORKSPACE`、`_PY_TIMEOUT_SECONDS`、`_ATTACHMENT_CONTENT_TYPES`（及 ponytail 注释）
3. 第 69-178 行 `handle_execute_python` 整个函数
4. 第 406-422 行 `handle_open_browser` 整个函数

- [ ] **Step 2: 清理不再使用的 import**

`backend/src/services/tool_handlers.py` 顶部第 10 行 `import sys` 仅被 `handle_execute_python` 使用（`sys.executable`），删除该行。保留：`asyncio`（call_mcp_sdk 用）、`json`、`shlex`、`subprocess`（execute_tool 用）、`time`（llm_fallback 用）、`urllib.request`（execute_tool 用）、`httpx`、`HumanMessage`（llm_fallback 用）。

- [ ] **Step 3: 语法验证 + 无残留**

```bash
cd backend && PYTHONPATH=src python -c "import services.tool_handlers; print('ok')"
grep -n "execute_python\|open_user_browser\|_ATTACHMENT\|_AGENT_WORKSPACE" backend/src/services/tool_handlers.py
```

Expected: `ok`；grep 无输出

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/tool_handlers.py && git commit -m "refactor: remove handle_execute_python and handle_open_browser"
```

---

### Task 5: 更新测试

**Files:**
- Modify: `backend/tests/services/test_tool_handlers.py`
- Modify: `backend/tests/tasks/test_agent_pipeline.py`
- Modify: `backend/tests/graph/test_agent_graph.py`
- Modify: `backend/tests/routers/test_routers_skills.py`
- Modify: `backend/tests/e2e/test_agent_crud.py`
- Modify: `backend/tests/system_team/test_system_team.py`

- [ ] **Step 1: test_tool_handlers.py 删除 6 个用例**

删除以下测试（整段 def，含装饰器/签名行）：
- `test_open_browser_publishes_event`（约 519）
- `test_open_browser_missing_url`（约 535）
- `test_open_browser_publish_failure_handled`（约 545）
- `test_open_browser_without_run_id`（约 558）
- `test_xlsx_generated_registers_attachment`（约 569）
- `test_preexisting_xlsx_not_reported`（约 630）

- [ ] **Step 2: test_agent_pipeline.py 改用自定义工具名**

`backend/tests/tasks/test_agent_pipeline.py` 第 447-477 行（去重测试）将所有 `execute_python` 替换为 `custom_python`：
- `ac.tools = '[{"name": "execute_python", "enabled": true}]'` → `'[{"name": "custom_python", "enabled": true}]'`
- `tool_mock.name = "execute_python"` → `"custom_python"`
- `skill_mock.tool_names = ["execute_python"]` → `["custom_python"]`
- `names.count("execute_python")` → `names.count("custom_python")`

- [ ] **Step 3: test_agent_graph.py 改用自定义工具名**

`backend/tests/graph/test_agent_graph.py` 第 33-55 行：`web_search` → `custom_search`、`calculator` → `custom_calc`（4 处 name + 断言 + wrapper 访问均改）。

- [ ] **Step 4: test_routers_skills.py 改用自定义工具名**

`backend/tests/routers/test_routers_skills.py`：第 163 行 `- execute_python` → `- custom_python`；第 177 行 `["execute_python"]` → `["custom_python"]`；第 193-208 行 `web_search` → `custom_search`。

- [ ] **Step 5: e2e/test_agent_crud.py 改用自定义工具名**

第 23、43 行 `calculator` → `custom_tool`。

- [ ] **Step 6: system_team/test_system_team.py 不动**

第 71 行 `"make a calculator"` 是用户提示词文本，非工具引用，保留。

- [ ] **Step 7: 运行后端全量测试**

```bash
cd backend && PYTHONPATH=src python -m pytest tests/ -q 2>&1 | tail -5
```

Expected: 全量通过（此前为 38 passed + 新增；无 FAIL）

- [ ] **Step 8: Commit**

```bash
git add backend/tests/ && git commit -m "test: update tests to drop builtin tool references"
```

---

### Task 6: 数据迁移脚本 + 执行

**Files:**
- Create: `scripts/remove_builtin_tools.py`

- [ ] **Step 1: 写迁移脚本**

```python
"""One-time migration: remove builtin tools from the database.

Run: cd backend && PYTHONPATH=src python ../scripts/remove_builtin_tools.py
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "src"))

from sqlalchemy import select

from core.infra.database import get_session_factory
from orm.agent import AgentConfigDB
from orm.content import RegisteredSkillDB, RegisteredToolDB

BUILTIN_TOOLS = {
    "web_search", "fetch_page", "calculator",
    "execute_python", "open_user_browser",
}


async def main() -> None:
    factory = get_session_factory()
    async with factory() as session:
        # 1) Delete builtin tool rows
        rows = (await session.execute(
            select(RegisteredToolDB).where(RegisteredToolDB.is_builtin == True)
        )).scalars().all()
        for r in rows:
            await session.delete(r)
        print(f"deleted {len(rows)} builtin tool rows")

        # 2) Clean agent tools JSON bindings
        agents = (await session.execute(select(AgentConfigDB))).scalars().all()
        cleaned_agents = 0
        for a in agents:
            if not a.tools:
                continue
            try:
                items = json.loads(a.tools)
            except Exception:
                continue
            if not isinstance(items, list):
                continue
            filtered = [
                t for t in items
                if isinstance(t, dict) and t.get("name") not in BUILTIN_TOOLS
            ]
            if len(filtered) != len(items):
                a.tools = json.dumps(filtered, ensure_ascii=False)
                cleaned_agents += 1
        print(f"cleaned {cleaned_agents} agent tool bindings")

        # 3) Clean skill tool_names
        skills = (await session.execute(select(RegisteredSkillDB))).scalars().all()
        cleaned_skills = 0
        for s in skills:
            if not isinstance(s.tool_names, list):
                continue
            filtered = [t for t in s.tool_names if t not in BUILTIN_TOOLS]
            if len(filtered) != len(s.tool_names):
                s.tool_names = filtered
                cleaned_skills += 1
        print(f"cleaned {cleaned_skills} skill tool_names")

        await session.commit()
        print("migration done")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 运行迁移**

```bash
cd backend && PYTHONPATH=src python ../scripts/remove_builtin_tools.py
```

Expected: `deleted N builtin tool rows`（N=5 或已清理过则为 0）、`cleaned ...`、`migration done`

- [ ] **Step 3: 验证数据库无内置工具**

```bash
cd backend && PYTHONPATH=src python -c "
import asyncio, json
from sqlalchemy import select
from core.infra.database import get_session_factory
from orm.content import RegisteredToolDB
from orm.agent import AgentConfigDB

async def check():
    factory = get_session_factory()
    async with factory() as session:
        tools = (await session.execute(select(RegisteredToolDB))).scalars().all()
        print('tools:', [(t.name, t.is_builtin) for t in tools])
        agents = (await session.execute(select(AgentConfigDB))).scalars().all()
        bad = 0
        for a in agents:
            if a.tools:
                try:
                    items = json.loads(a.tools)
                    if any(isinstance(t, dict) and t.get('name') in {'web_search','fetch_page','calculator','execute_python','open_user_browser'} for t in items):
                        bad += 1
                except Exception:
                    pass
        print('agents with builtin tool bindings:', bad)
asyncio.run(check())
"
```

Expected: `tools: [...]`（无 is_builtin=True 行）、`agents with builtin tool bindings: 0`

- [ ] **Step 4: Commit**

```bash
git add scripts/remove_builtin_tools.py && git commit -m "chore: add migration script to remove builtin tools from DB"
```

---

### Task 7: 端到端验证

- [ ] **Step 1: 重启后端**

```bash
make dev-backend
```

等待健康检查通过：

```bash
curl -s http://localhost:8081/api/health
```

Expected: `{"status": "ok", ...}`

- [ ] **Step 2: 验证 plugins 端点为空的**

```bash
curl -s http://localhost:8081/api/tools/plugins
```

Expected: `[]`

- [ ] **Step 3: 验证工具列表无内置**

```bash
curl -s http://localhost:8081/api/tools
```

Expected: 列表无 web_search/fetch_page/calculator/execute_python/open_user_browser

- [ ] **Step 4: 前端验证（浏览器）**

打开 http://localhost:5174 → 管理工作台 → 工具管理：列表无内置工具；Agent 表单工具选择器无内置工具；MCP 管理仍可添加第三方 MCP（fetch/memory）。

- [ ] **Step 5: 收尾 Commit（如有遗留）**

```bash
git status
```

若无改动则跳过。

---

## Self-Review

**Spec 覆盖：**
- 删除 3 插件文件 → Task 1 ✓
- seed.py static_builtins → Task 2 ✓
- tool_config 分支 → Task 3 ✓
- tool_handlers 两 handler → Task 4 ✓
- 数据清理（registered_tools/agent 绑定/skill tool_names）→ Task 6 ✓
- 测试更新 → Task 5 ✓
- registry/MCP/HTTP/Skill/llm_fallback 保留 → 各任务明确"保留" ✓
- 前端零改动 → 未列前端修改任务（仅验证）✓
- 验收标准 → Task 7 ✓

**Placeholder scan:** 无 TBD/TODO；每个删除动作给到函数名/行范围/精确文本；测试改动给到具体名称与替换值。

**Type consistency:** 迁移脚本中 BUILTIN_TOOLS 集合与 spec 5 个工具名一致；测试替换名 custom_python/custom_search/custom_calc/custom_tool 各自作用域内一致。
