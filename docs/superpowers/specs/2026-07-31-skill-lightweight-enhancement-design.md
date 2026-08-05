# Skill 轻量增强 + 工具/MCP 表单行业对齐

日期：2026-07-31
状态：已确认

## 背景

现状 skill 执行模型 = 纯提示词注入：`handle_skill` 把 instructions 文本返回给模型，模型照着执行。
运行时真正生效的字段只有 `instructions`、`output_constraint`、`tool_names`（后两者被拼入
instructions 文本）。`prompt_id` 完全无代码使用；`model` 只存在于前端表单，后端表里没有。

调研行业现状（GitHub 生态）：
- **SKILL.md 格式已统一**（Anthropic 主导，被 Codex/Cursor/Gemini CLI/Copilot/Cline 适配层采用），
  每个 skill = 目录（`SKILL.md` + `scripts/` + `references/`）。
- **scripts 执行不统一**：仅 Claude Code 原生执行；其他平台退化为"提示词注入 + 让模型写代码/调工具"。
- 项目已有 `execute_python` 沙箱执行器，可复用为脚本能力落地点。

## 产品决策

1. **定位：轻量增强**（对齐行业主流 Codex/Cursor 路线）——instructions 注入 + 子工具绑定，
   不重造脚本执行层；脚本需求引导模型走 `execute_python` 沙箱。
2. **删除死字段**：后端 `prompt_id` 列删除；前端 `model`、`prompt_id` 表单字段删除。
3. **scripts/ 目录上传**：导入支持 multipart 目录上传，脚本内容存入独立字段。
4. **子工具绑定深度**：`tool_names` 真实注册到 `graph.bind_tools`，可调用；不存在的工具跳过注册。
5. **allowed-tools 兼容映射**：已存在工具→注册可调；不存在→脚本参考 + 引导 execute_python。
6. 纯文本粘贴导入入口保留（兼容旧接口）。

## 数据模型

`registered_skills` 表（backend/src/orm/content.py `RegisteredSkillDB`）：

- **删除** `prompt_id` 列（String(36), nullable）——无任何代码使用。
- **新增** `script_files` 列：`JSON, nullable`——存 `{"scripts/recalc.py": "<内容>", "references/api.md": "<内容>"}`。
- 保留：`name, category, content, author, version, status, instructions, tool_names(JSON), output_constraint`。
- 迁移方式：dev 环境手动 `ALTER TABLE registered_skills DROP COLUMN prompt_id` + 新列由 ORM 自动建，
  或写轻量迁移脚本。生产需正式迁移。

## 导入接口

`POST /api/skills/import`（backend/src/routers/skills.py）：

- 改为 **multipart/form-data**，字段：
  - `SKILL.md`（必填）
  - `scripts/*`、`references/*`、`resources/*`（可选，任意文件名）
- 解析逻辑（复用现有 yaml frontmatter 解析）：
  - frontmatter：`name` / `description` / `allowed-tools` / `metadata.category` + 新增 `license`
  - 正文 → `instructions`
  - 所有非 SKILL.md 文件内容 → `script_files`（key=上传相对路径）
  - `allowed-tools` → `tool_names`
- **兼容**：保留纯文本入口 `{markdown: str}`（前端"粘贴"tab），无 script_files。

## 运行时

backend/src/tasks/agent_pipeline.py `-- Bind skills --` 段：

1. **子工具注册**：对 `skill_match.tool_names` 中每个名称：
   - 在 `registered_tools`（含 builtin）中存在 → 用其定义构造 `ToolConfig` 追加到 `tool_configs`，
     模型可实际调用。
   - 不存在 → 跳过注册，仅保留 instructions 文本清单（兼容映射）。
2. **script_files 注入**：将 `skill_match.script_files` 内容拼入 instructions，格式：
   ```
   ## 参考脚本
   ### scripts/recalc.py
   ```python
   <内容>
   ```
   ```
   模型读到脚本逻辑后自行用 `execute_python` 复现。
3. `handle_skill`（backend/src/services/tool_handlers.py）不变：返回 instructions 文本。
4. 空 instructions 的 unconfigured 防呆逻辑保持不变。

## 前端

- **删字段**：`SkillFormData` / `SkillEntry`（skill.types.ts）删 `model`、`prompt_id`；
  `SkillFormModal.tsx` 删模型下拉与 prompt ResourcePicker；后端 prompt_id 删除后同步移除前端 prompt 字段。
- **保留表单**：name, description, category, status, version, instructions, output_constraint, tool_names。
- **导入入口**（SkillManagement.tsx）：弹窗内 `Upload.Dragger` 选目录/多文件（SKILL.md + scripts + references）
  → multipart 上传；保留"粘贴纯文本" tab（调旧接口）。
- **i18n**：新增上传相关文案（zh-CN / en-US）。

## 测试

后端：
- `test_routers_skills.py`：目录上传（SKILL.md + scripts/recalc.py）→ `script_files` 入库、frontmatter 映射、
  纯文本旧接口可用、无 SKILL.md 400。
- `test_tool_handlers.py`：`handle_skill` 返回含参考脚本的 instructions。
- agent_pipeline 子工具注册：已存在工具→生成 ToolConfig；不存在→跳过。

前端：
- `validate.test.ts`：删 model 后校验通过。
- SkillFormModal：模型下拉与 prompt picker 已移除。

手动：
- 用官方 `anthropics/skills/xlsx` 目录实测导入 → 绑 agent → 生成带公式 xlsx → 验证脚本参考生效 + 附件下载。
- MCP：添加带 args/env 的 stdio server（如 npx）→ 测试按钮成功 → agent 会话中可调用其工具。

## 范围外（不做）

- 不实现 scripts 原生执行（沿用行业主流"模型写代码"路线）。
- 不做 progressive disclosure 按需加载 references（全量拼入）。
- 不处理 skill 独立模型（`model` 字段已删）。

## 工具/MCP 表单行业对齐（本次一并实施）

### 工具表单（frontend/src/components/AgentStudio/workstation/tool/）

现状：`model` 字段是死字段——`RegisteredToolDB.model` 列存在且被读（content.py:39、
repository/tools.py:23），但运行时代码没有任何地方使用工具的 model（执行走 HTTP/plugin/LLM fallback）。

- **删除 `model`**：`ToolFormData` / `ToolEntry`（tool.types.ts）、`ToolFormModal.tsx` 模型下拉、
  `validate.ts` 中相关字段。
- 保留：name, description, category, status, version, endpoint, parameters, 测试按钮。

### MCP 表单（frontend/src/components/AgentStudio/workstation/mcp/）

对照 MCP 官方 `mcpServers` 配置（`command` / `args` / `env`），补齐缺口。存储复用现有
`MCPServerDB.config`（Text，现只被读未用于 stdio 执行），无需加列。

- **新增 `args` 字段**（可选）：启动参数，如 `-y @modelcontextprotocol/server-brave-search`。
  前端多行输入（每行一个参数）。
- **新增 `env` 字段**（可选）：环境变量，`KEY=VALUE` 多行输入，如 `BRAVE_API_KEY=xxx`。
- **类型叫法**：`sse` 选项显示文案改为「Streamable HTTP」；`MCP_TYPE_OPTIONS` 值不变
  （`stdio` / `sse`），仅显示层映射（避免 DB 迁移）。
- **警告提示**：选 `sse` 类型时，表单内提示「SSE 已由 Streamable HTTP 取代，优先使用
  Streamable HTTP 端点」。
- **运行时**（backend/src/services/tool_handlers.py `call_mcp_sdk` / `_discover_mcp_tools`，
  backend/src/tasks/agent_pipeline.py）：从 `config` 读 `args` / `env`，构造
  `StdioServerParameters(command=..., args=..., env=...)`，替代现有 `shlex.split(tool_self.mcp_endpoint)`。
  已存在 endpoint 含内联参数的兼容（`shlex.split`）保留。

### 测试

- 前端：`validate.test.ts` 工具删 model 后通过；MCPFormModal 显示 args/env 字段与 SSE 警告。
- 后端：MCP stdio 执行带 args/env 的单测（config 解析 → StdioServerParameters 参数正确）。
