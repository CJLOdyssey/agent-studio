# 术语表

> AgentStudio 项目术语参考，帮助理解代码和文档中的专业概念。

---

## Agent 概念

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **Agent** | AI 代理，具有独立配置、提示词和工具的执行单元 | `backend/orm/agent_config.py` |
| **Team** | 多 Agent 协作组，包含工作流配置和角色分配 | `backend/orm/teams.py` |
| **Workflow** | Team 内的执行流程，定义 Agent 间的调度关系 | `backend/orm/workflow_configs.py` |
| **Skill** | Agent 可调用的预定义技能（如搜索、计算） | `backend/routers/skills.py` |
| **MCP** | Model Context Protocol，Agent 可调用的外部工具协议 | `backend/routers/mcps.py` |
| **Prompt** | 提示词模板，Agent 执行时使用的基础指令 | `backend/routers/prompts.py` |
| **Tool** | Agent 可使用的工具，包括内置、MCP、Skill 三类 | `backend/routers/tools.py` |

---

## 架构术语

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **LangGraph** | 基于图的 Agent 执行框架，支持状态机和工具调用 | [ADR-001](./adr/001-langgraph-dual-engine.md) |
| **SingleAgentGraph** | 单 Agent 执行图，处理独立代理任务 | `backend/agent_graph.py` |
| **DynamicTeamGraph** | 多 Agent 协作图，支持 fan-out/fan-in 并行调度 | `backend/workflow/dynamic_team_graph.py` |
| **Three-layer strict** | 后端三层架构：`database.py → repository/ → routers/` | `backend/core/`, `backend/repository/` |
| **Circuit Breaker** | 熔断器，防止级联故障，保护下游服务 | `backend/core/circuit_breaker.py` |

---

## 流式处理

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **StreamEmitter** | 流式输出发射器，将 LLM 响应推送到前端 | `backend/streaming.py` |
| **Thinking tokens** | LLM 推理过程的中间输出，缓冲后批量发送 | `backend/streaming.py` |
| **pub/sub** | Redis 发布/订阅，用于实时消息传递 | `backend/core/redis.py` |
| **fan-out** | 将任务分发给多个 Agent 并行执行 | `backend/workflow/dynamic_team_graph.py` |
| **fan-in** | 收集多个 Agent 的执行结果并合并 | `backend/workflow/dynamic_team_graph.py` |

---

## 认证与授权

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **RBAC** | 基于角色的访问控制，支持用户-角色-权限模型 | `backend/auth/` |
| **legacy mode** | 简单认证模式，固定 admin 用户，无需数据库 | `backend/config.py` |
| **JWT** | JSON Web Token，用于身份验证（HS256 签名） | `backend/auth/jwt.py` |
| **refresh token rotation** | 刷新令牌轮换，防止令牌重放攻击 | `backend/auth/refresh.py` |

---

## 基础设施

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **Celery** | 分布式任务队列，处理 Agent 执行等异步任务 | `backend/tasks.py` |
| **Key Vault** | 密钥保险库，Fernet 加密存储 API 密钥 | `backend/core/key_vault.py` |
| **Fernet** | 对称加密算法，用于密钥加密存储 | `backend/core/key_vault.py` |
| **Checkpointer** | 执行检查点，保存 Agent 执行状态用于恢复 | `backend/checkpoint/` |
| **EventStore** | 可观测性事件存储，基于 SQLite 记录系统事件 | `backend/observability/store.py` |

---

## 前端术语

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **WorkstationPage** | 主工作台页面，包含 10 个功能标签页 | `frontend/src/components/WorkstationPage.tsx` |
| **tabConfig** | 标签页配置，定义各模块的路由和组件 | `frontend/src/config/tabConfig.ts` |
| **useGenericCrud** | 通用 CRUD Hook，提供增删改查基础功能 | `frontend/src/hooks/useGenericCrud.ts` |
| **chatStore** | 聊天状态管理，基于 Zustand 实现 | `frontend/src/stores/chatStore.ts` |
| **TestProviders** | 测试包装组件，提供 QueryClient 等上下文 | `frontend/src/test/setup.tsx` |

---

## 其他术语

| 术语 | 说明 | 相关文件 |
|------|------|----------|
| **DAG** | 有向无环图，Workflow 的执行拓扑结构 | `backend/workflow/` |
| **Alembic** | SQLAlchemy 数据库迁移工具 | `alembic/` |
| **pgvector** | PostgreSQL 向量扩展，支持向量相似度搜索 | `docker/compose.local.yml` |
| **Prometheus RED** | 监控指标：Rate、Errors、Duration | `backend/metrics.py` |

---

## 缩写表

| 缩写 | 全称 |
|------|------|
| MCP | Model Context Protocol |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| DAG | Directed Acyclic Graph |
| CRUD | Create, Read, Update, Delete |
| SPA | Single Page Application |
| RED | Rate, Errors, Duration |
| ADR | Architecture Decision Record |
