# 📋 Anchored Summary — 虚拟软件外包团队

> 最后更新: 2026-06-23 | Sisyphus Session

---

## Goal
从企业角度全面评估项目功能，用最小代码量实现优化，进行企业级端到端测试（API + 前端 E2E），并修复 Agent 配置 tools/MCP/skills 未传递给 Agent Graph 的架构缺口。

## 总体进展
- **总分评估**: 81.5/100（11 维度）
- **已实现**: 32 API 测试全部通过 + 12 前端 E2E 测试全部通过 + 37/39 后端回归测试通过
- **核心修复**: Agent Graph 工具传递架构缺口已修复（`ToolConfig` + `bind_tools` + `_raw_llm_stream` 注入）

---

## 已完成的修改

### 后端 API 修正
| 文件 | 修改 | 影响 |
|------|------|------|
| `routers/agents.py` | 新增 `GET /api/agents/{id}` 端点 + `_parse_json()` 函数 | Agent 详情查询修复 |
| `repository/agents.py` | `delete_agent_config()` 添加 `return True` | 删除后不再返回 404 |
| `routers/agents.py` | `get_agent` 端点中对 JSON 字符串字段调用 `_parse_json()` | tools/MCP/skills 字段正确解析为 list |

### Agent Graph 架构修复
| 文件 | 修改 | 影响 |
|------|------|------|
| `agent_graph.py` | 新增 `ToolConfig` dataclass（`name`, `description`） | 轻量级工具描述符 |
| `agent_graph.py` | 新增 `_ToolWrapper` class（`.invoke()` 返回 JSON） | 工具执行节点可调用 |
| `agent_graph.py` | `__init__` 新增 `_tool_definitions: list[dict]` | 存储 OpenAI 兼容的工具定义 |
| `agent_graph.py` | `bind_tools()` 重写：接受 `list[ToolConfig]`，生成 API 工具定义 + `_tool_map` | 将外部工具注册到 graph |
| `agent_graph.py` | `_raw_llm_stream()` 注入 `body["tools"] = self._tool_definitions` | LLM API 请求中告知可用工具 |

### tasks.py 修改
| 修改 | 影响 |
|------|------|
| `_run_agent_pipeline()` 中解析 `ac.tools`/`ac.mcp`/`ac.skills` | 从 agent 配置提取工具/MCP/Skills 引用 |
| 调用 `get_tools()`/`get_mcps()`/`get_skills()` 查找描述信息 | 从数据库获取注册资源的详细信息 |
| 创建 `ToolConfig` 对象列表并调用 `graph.bind_tools()` | 将完整工具链注入 Agent Graph |

### 架构设计原则
- **高内聚**: `ToolConfig` 封装工具描述所需的所有信息；`_ToolWrapper` 封装调用逻辑
- **低耦合**: `tasks.py` 只负责解析配置和查找注册资源，不关心 graph 内部的工具执行细节
- **最小侵入**: 仅修改 2 个后端文件（`agent_graph.py` + `tasks.py`），无需新增 DB 查询、无需修改前端代码
- **前缀区分**: tools → 原始 name，MCP → `mcp_{name}`，skills → `skill_{name}`，避免命名冲突

### 测试结果
| 测试 | 结果 | 时间 |
|------|------|------|
| API E2E 集成测试（32 用例） | ✅ 32 passed | 9.58s |
| 后端回归测试 | ✅ 37 passed, 2 pre-existing failures（`test_conversation.py: StreamEmitter._pending_thinking`） | 10.35s |
| 前端 Playwright E2E（12 用例） | ✅ 12 passed | 30s 内 |

---

## 未解决问题
- **`StreamEmitter._pending_thinking`** — `test_conversation.py` 中 2 个 pre-existing 失败，非本次改动导致。根因：`streaming.py` 中 `_pending_thinking` 属性缺失。

---

## 关键文件索引

| 文件路径 | 说明 |
|----------|------|
| `virtual_team/tests/test_e2e_full_flow.py` | 32 个 API 端到端测试（团队/Agent/Prompt/工具/MCP/Skills/会话/Run/全流程） |
| `scripts/test_e2e_frontend.py` | 12 个前端 Playwright E2E 测试 |
| `virtual_team/agent_graph.py` | Agent Graph 引擎（ToolConfig + bind_tools + _raw_llm_stream 工具注入） |
| `virtual_team/tasks.py` | Celery 任务（_run_agent_pipeline 解析 agent 配置绑定工具） |
| `virtual_team/routers/agents.py` | Agent API 路由（含 _parse_json 修复） |
| `virtual_team/repository/agents.py` | Agent 数据访问层 |
| `virtual_team/repository/tools.py` | 注册工具 CRUD（含 get_tools） |
| `virtual_team/repository/mcps.py` | MCP CRUD（含 get_mcps） |
| `virtual_team/repository/skills.py` | Skills CRUD（含 get_skills） |
| `frontend/src/components/devagents/` | 前端工作站模块 |
| `scripts/fix_playwright_libs.sh` | Playwright 系统库修复脚本 |

---

## 命令备忘录
```bash
# API E2E 测试
PYTHONPATH=. python3 -m pytest virtual_team/tests/test_e2e_full_flow.py -v --tb=short

# 全部后端测试
PYTHONPATH=. python3 -m pytest virtual_team/tests/ -v --tb=short

# 前端 E2E 测试
export LD_LIBRARY_PATH=/tmp/playwright-libs/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
timeout 90 python3 scripts/test_e2e_frontend.py

# Docker 部署
docker compose -f docker-compose.local.yml build --no-cache backend
docker compose -f docker-compose.local.yml up -d --force-recreate backend
```
