# 多 Agent 协作 · 行业竞品主流对标（2026-08-05）

> 结论基于官方 README 实证 + 本项目代码核验。证据等级：✅ 官方/实证　⚠️ 推断　❌ 证伪
> 本项目代码核验经 codegraph 全量索引交叉确认；行业主流结论来自 LangGraph / CrewAI / AutoGen / OpenAI Agents SDK 官方 README（2026-08-05 多 Agent 会话已核验）。

## 一、本项目现状定位（核验版）

**已实现**
- DAG 编排（fan-out/fan-in）：基于 LangGraph 低层 `StateGraph` 自建节点图 ✅（`backend/src/workflow/`，`WorkflowNode`/`WorkflowEdge` 声明节点与边，`node_factory.py` 生成可调用节点）
- 每节点**实时流式**：`node_factory.py` 的 `node_fn` 内 `cb` 回调将 LLM 增量 chunk 经 `publish_run_message(run_id, {"type", "agent_name": node.role_identifier, "content"})` 直发 Redis，工具调用过程同样流式（thinking_stream）✅（`backend/src/workflow/node_factory.py:126-137`）
- 前端按 `agent_name` 分气泡渲染 ✅（`MessageItem.agent_name` 透传，`TeamMessage` 组件按 agent 分组）
- 固定 3 角色策略：`Role` 枚举 pm / programmer / tester，`strategies.py` 三策略（Reviewer/Reporter 等）+ 关键词路由 ✅（`backend/src/core/models.py:11-27`，`WorkflowEdge.conditionKey`）
- 记忆/checkpointer：run 结果（pm_document/code/review）持久化 + 会话记忆写入（`_save_output_memories`）✅（`backend/src/repository/run_repo.py:90-109`，`pipeline_utils.py:310`）
- 可观测：自建 SQLite `EventStore`（trace/span 关联、慢查询、错误检索）+ Prometheus RED 指标 ✅（`backend/src/observability/store.py`，`core/infra/metrics.py`）
- MCP 绑定：`AgentMCP` 配置 + MCP 管理页 + 前端绑定 ✅（`frontend/src/types/AgentStudio.ts:16`，`workstation/mcp/MCPManagement`）

**未实现**
- 审批门禁：`is_approver` / `approved` 仅持久化，`approved` 无任何读取点（无下游门禁判定）❌（`backend/src/repository/agents.py:88`、`run_repo.py:95`）
- 迭代回环：`maxRounds` 字段存在但引擎单趟直通，无 while 回环；`_MAX_TOOL_ROUNDS` 仅为单节点内工具调用轮次上限，非工作流迭代 ❌（`WorkflowConfig.maxRounds` 前端类型存在，`node_factory.py:22`）
- 结构化输出（输出约束为自由文本，非 schema 强制）⚠️
- LLM 路由（路由为关键词子串匹配，非模型决策）⚠️
- HITL（无人工介入点）⚠️

## 二、五维对标表

源：LangGraph / CrewAI / AutoGen / OpenAI Agents SDK 官方 README（2026-08-05 多 Agent 会话已核验）。行业主流列为各框架 README 声明能力的并集。

| 维度 | 本项目 | 行业主流 | 差距 |
|---|---|---|---|
| 编排模式 | DAG + 固定策略 ✅ | DAG / supervisor / swarm / handoff | 缺 supervisor/swarm/handoff |
| 角色模型 | 3 硬编码（pm/programmer/tester）✅ | CrewAI `role`/`goal`/`backstory` 声明式、动态创建 | 角色不可声明式扩展 |
| 动态路由 | 关键词子串 ✅ | OpenAI SDK handoffs / 层级委派 | 缺 LLM 决策路由 |
| 流式 | 已实现（每节点实时，含工具过程）✅ | `run_stream`/`astream_events` 一等公民 | 达标 |
| HITL | 无 | `interrupt()` / `Command` 人机协作 | 缺人工介入 |
| 记忆 | checkpointer + 会话记忆 ✅ | 短/长期 memory + sessions | 达标（粒度可增强） |
| 质量门 | 无强制执行 | 结构化输出 / guardrails / 人工 review | 缺强制 schema 与门禁 |
| 可观测 | 自建 EventStore + Prometheus ✅ | LangSmith / tracing | 达标（生态集成可选） |

## 二·五、同层对标（LangGraph 官方多 Agent 模式——本项目架构首选参照）

> 事实：本项目基于 LangGraph 原语自建编排；CrewAI 依赖 langchain-core 而非 langgraph（官方 pyproject 实证 ✅），故 CrewAI 是「产品能力参照」，LangGraph 官方 supervisor/swarm 才是「同层架构参照」。

| LangGraph 官方模式 | 说明 | 本项目现状 | 差距 |
|---|---|---|---|
| **supervisor**（`reference/supervisor/`） | 中央协调者 LLM 分派子 Agent | 无 supervisor 节点类型，仅静态 DAG | 待加（可作 add-01 后续） |
| **swarm**（`reference/swarm/`） | 轻量 handoff 交接 | 无 handoff 机制 | 待加 |
| **agents 原语** | 高层 agent 封装 | 使用低层 `StateGraph` 自建 | 可用但未封装 |
| **subgraph** | 子图嵌套组合 | 未使用 | 可选 |
| **MCP**（`reference/mcp/`） | 一等公民 | 已实现 MCP 绑定 ✅ | 达标 |

## 三、差距清单（可执行化）

| # | 差距 | 状态 | 对应方案 |
|---|---|---|---|
| 1 | 审批门禁不执行（`approved` 无读取点）| 已确认 ❌ | add-01 |
| 2 | 无迭代回环（`maxRounds` 未用）| 已确认 ❌ | add-01 |
| 3 | 无结构化输出（schema 强制）| ⚠️ | add-01 |
| 4 | 无 LLM 路由（仅关键词）| ⚠️ | add-01 |
| 5 | 无 HITL | ⚠️ | add-01（后端）+ add-03（前端） |
| 6 | 前端策略选择/状态展示缺失 | ⚠️ | add-03 |
| 7 | 引擎单趟直通 | 已确认 ❌ | 已被 add-01 覆盖 |

## 四、三阶段路线图

- **Phase 1 地基修复**（14 项 fix-01..14）：门禁可信、安全、工程化 → 评分 6.2 → 7.3
- **Phase 2 协作闭环**（add-01 + add-03）：审批 / 迭代 / 结构化 / LLM 路由 / UI → 对齐 CrewAI Flows 水平
- **Phase 3 动态智能**（follow-up）：handoff / 层级委派、HITL 弹窗、A2A 互操作 → 对齐 OpenAI Agents SDK 水平
