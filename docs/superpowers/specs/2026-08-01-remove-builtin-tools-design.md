# 移除内置硬编码工具设计

- 日期：2026-08-01
- 状态：已确认（待实现）
- 决策人：用户
- 相关：2026-08-01-marketplace-registry-design.md

## 背景与目标

平台后端硬编码了一批内置工具（插件 + 静态内置），用户无法按需增删。
目标：**删除全部内置工具实现**，平台零预置工具；所有能力由用户在前端添加
（第三方 MCP / Skill / 自定义工具）。保留支撑"添加第三方能力"的通用基础设施。

## 内置工具完整清单（将被删除）

| 工具名 | 类型 | 位置 |
|---|---|---|
| web_search（Tavily 搜索） | registry 插件 | `backend/src/thinking_tree/tools/tavily_search.py` |
| fetch_page（网页抓取） | registry 插件 | `backend/src/thinking_tree/tools/fetch_page.py` |
| calculator（计算器） | registry 插件 | `backend/src/thinking_tree/tools/calculator.py` |
| execute_python（沙箱执行） | 静态内置 | `backend/src/core/seed.py` static_builtins + `tool_config.py:94` 名字分支 + `tool_handlers.py` handle_execute_python |
| open_user_browser（打开浏览器） | 静态内置 | `backend/src/core/seed.py` static_builtins + `tool_config.py:118` 前缀分支 + `tool_handlers.py` handle_open_browser |

## 删除动作

### 1. 文件删除

- `backend/src/thinking_tree/tools/tavily_search.py`
- `backend/src/thinking_tree/tools/fetch_page.py`
- `backend/src/thinking_tree/tools/calculator.py`
- `backend/src/thinking_tree/tools/__init__.py` 中对应导入（若有）

### 2. 代码修改

- `backend/src/core/seed.py`：`seed_builtin_tools()` 删除 `static_builtins` 列表及写入循环；
  函数骨架保留（仍同步 registry 插件 → registered_tools，registry 空则无操作）。
- `backend/src/services/tool_config.py`：
  - 删除 `_resolve_handler()` 中 `self.name == "execute_python"` 分支（:94）
  - 删除 `invoke()` 中 `open_user_browser` 前缀分支（:118-120）
  - 保留 registry 分发循环（:106-115）、mcp/http/skill 字段分发、llm_fallback
- `backend/src/services/tool_handlers.py`：
  - 删除 `handle_execute_python`
  - 删除 `handle_open_browser`
  - 保留 `handle_mcp`、`call_http_endpoint`、`handle_skill`、`llm_fallback`
  - 相关 imports（httpx 等）同步清理

### 3. 数据清理（一次性迁移脚本）

- `registered_tools` 表：删除所有 `is_builtin = True` 的行（5 条）
- Agent 工具绑定：清空 agent 配置中引用上述 5 个工具名的 toolIds
- Skill 的 `tool_names`：移除上述 5 个工具名

### 4. 测试更新

删除/调整引用内置工具的用例：

- `backend/tests/services/test_tool_handlers.py`
- `backend/tests/tasks/test_agent_pipeline.py`
- `backend/tests/routers/test_routers_skills.py`
- `backend/tests/e2e/test_agent_crud.py`
- `backend/tests/graph/test_agent_graph.py`
- `backend/tests/system_team/test_system_team.py`

## 保留项（通用功能，支撑前端添加第三方能力）

| 层 | 保留内容 |
|---|---|
| 前端 | 工具管理 / MCP 管理 / Skills 管理 / 密钥管理 / 提示词管理 / 输出约束 / Agent 管理 全部模块，零改动 |
| 后端 | `thinking_tree/registry.py` 插件框架（含 registry 分发循环）、MCP 分发（stdio/sse）、HTTP 分发（自定义工具 endpoint）、Skill 分发（skill_ 前缀）、`llm_fallback` 兜底、`/api/tools/plugins` 端点（返回空列表） |
| 数据 | registered_tools 中用户自建（is_builtin != True）的工具 |

## 前端影响

- `AgentManagement.tsx` 中 plugins 合并逻辑保留（`/api/tools/plugins` 返回空数组，行为自然为空）
- 工具选择器只显示用户自建工具 + 空插件列表
- 无其他前端代码改动

## 能力影响与替代方案

| 失去的能力 | 替代方案（MCP 生态） |
|---|---|
| 实时搜索 | 用户装 `tavily-mcp` |
| 网页抓取 | 用户装 `@modelcontextprotocol/server-fetch` |
| 执行 Python 代码（含官方 xlsx 技能 recalc.py 脚本） | 用户装第三方 python 执行 MCP（如 `python-executor-mcp`）；**未装前 xlsx 技能脚本不可执行** |
| open_user_browser（平台私有 WebSocket 能力） | 无 MCP 等价物，功能消失 |
| execute_python 附件自动注册下载链接 | 消失（MCP 工具生成的文件无法注册附件） |

## 风险

- 存量 agent 绑定被清空后，用户需重新用 MCP/Skill 方式配置能力
- 官方 xlsx 技能脚本依赖 execute_python，删除后需 python MCP 才能恢复完整功能
- 测试中依赖内置工具的用例需同步删除，避免 CI 失败

## 验收标准

1. 启动后 `registered_tools` 无 is_builtin 行
2. `/api/tools/plugins` 返回空数组
3. 前端工具管理/Agent 表单不再显示内置工具
4. 用户可通过 MCP 管理添加第三方 MCP 并绑定 agent 正常调用
5. 全量后端测试通过
