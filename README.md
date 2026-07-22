# AgentStudio

> AI Agent 编排平台 — 支持单 Agent 对话和多 Agent DAG 工作流，可自定义角色、提示词、工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-1e3a5f.svg)](https://langchain-ai.github.io/langgraph/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D.svg)](https://redis.io/)

---

## 目录

- [概述](#概述)
- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [架构设计](#架构设计)
- [API 文档](#api-文档)
- [部署](#部署)
- [开发指南](#开发指南)

---

## 概述

AgentStudio 是一个 AI Agent 编排平台。用户可以创建和配置 AI Agent，自定义角色、提示词、工具，支持单 Agent 对话和多 Agent DAG 工作流。

**核心能力：**

- **多 Agent 协作** — 多个 AI Agent 按角色分工，通过 LangGraph 编排协同工作
- **DAG 工作流** — 可视化拖拽编辑器 + 动态图执行引擎，支持 fan-out/fan-in 并行
- **实时流式输出** — DeepSeek reasoning_content 实时推送思考链
- **全链路可观测** — 内置事件存储、trace 追踪、慢查询检测、自诊断端点
- **灵活扩展** — 自定义 Agent 角色/提示词/工具/MCP/Skills，版本管理
- **BYOK 密钥保险箱** — Fernet 加密存储，用户自带 API 密钥
- **RBAC 认证** — JWT + 角色权限控制，login/register/forgot-password 完整流程

---

## 核心特性

### 双引擎架构

| 引擎 | 用途 | 特点 |
|------|------|------|
| **SingleAgentGraph** | 单 Agent 对话 | ReAct 模式，DeepSeek 思考链，流式输出 |
| **DynamicTeamGraph** | 多 Agent 工作流 | DAG 编排，generator/reviewer/reporter 策略，fan-out/fan-in 并行 |

### 10 个管理模块

| 模块 | 说明 |
|------|------|
| 团队管理 | 创建团队分组，一键触发多 Agent 协同工作流 |
| 工作流 | 可视化 DAG 编辑器（React Flow），拖拽式设计 |
| Agent 管理 | 配置 AI Agent 角色、提示词、工具绑定 |
| 提示词管理 | 创建、编辑、分类提示词，支持导入导出 |
| 输出约束 | 定义 Agent 输出格式和约束条件 |
| 工具管理 | 内置工具注册和 MCP 服务器配置 |
| MCP 管理 | Model Context Protocol 服务器配置 |
| Skills 管理 | 自定义 Skill 安装和管理 |
| 监控中心 | 实时监控 Agent 执行状态 |
| 审计日志 | 操作日志追踪和审计 |

### 可观测性系统

| 能力 | 说明 |
|------|------|
| **事件存储** | SQLite 本地存储，后台批量写入，零阻塞 |
| **全链路追踪** | trace_id 贯穿 HTTP → 后端 → DB → LLM 调用 |
| **自诊断** | `GET /api/debug/health` 暴露写入错误、队列积压、磁盘状态 |
| **错误分析** | 自动聚合 trace 内错误，给出根因建议 |
| **慢查询检测** | SQLAlchemy 事件监听，>500ms 自动告警 |
| **Prometheus 指标** | HTTP/LLM/Tool/Graph/Stream/DB 六层 RED 指标 |

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| TypeScript | 5.6 | 类型系统（strict 模式） |
| Vite | 6.0 | 构建工具 |
| Tailwind CSS | 3.4 | 样式 |
| Zustand | 5.0 | UI/chat 状态管理 |
| TanStack Query | 5.100 | 服务器数据获取 |
| React Flow | 11.x | 工作流 DAG 编辑器 |
| React Router | 6.28 | 路由 |
| i18next | 26.3 | 国际化（中/英） |
| Ant Design | — | UI 组件库 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.12 | 运行时 |
| FastAPI | 0.110 | Web 框架 |
| LangGraph | 0.2 | AI Agent 编排（双引擎） |
| SQLAlchemy | 2.0 | 异步 ORM |
| PostgreSQL | 16 + pgvector | 数据库 |
| Redis | 7.2 | 缓存/消息队列/限流 |
| Celery | 5.6 | 异步任务执行 |
| Alembic | — | 数据库迁移 |
| Pydantic | — | 配置验证 |
| Fernet | — | 密钥加密存储 |
| Prometheus | — | 指标收集 |

### 基础设施

| 技术 | 用途 |
|------|------|
| Docker / Docker Compose | 容器化部署 |
| nginx | 前端反向代理（生产） |
| GitHub Actions | CI/CD（10-job 流水线） |
| Alibaba Cloud ACR | 容器镜像仓库（生产） |
| Helm | Kubernetes 部署配置 |

---

## 快速开始

> 完整启动指南（本地开发 / Docker / CLI）见 [QUICKSTART.md](QUICKSTART.md)。

### 环境要求

- Node.js >= 20.0 / Python >= 3.12
- PostgreSQL >= 16 / Redis >= 7.2
- Docker（可选，用于容器化部署）

### 方式一：Docker 一键启动（推荐）

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio

# 启动所有服务（PostgreSQL + Redis + Backend + Celery + Frontend）
docker compose -f docker/compose.local.yml up -d

# 查看日志
docker compose -f docker/compose.local.yml logs -f
```

访问 http://localhost:5173

### 方式二：本地开发

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio

# 前端
cd frontend && npm install && npm run dev

# 后端（新终端）
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 编辑 .env，配置 DEEPSEEK_API_KEY
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python3 -m uvicorn backend.core.app:app --reload --port 8080
```

访问 http://localhost:5173

### 方式三：CLI 单次运行

```bash
PYTHONPATH=. python3 -m backend.main "你的需求描述"
```

---

## 项目结构

```
agent-studio/
├── frontend/                    # React 前端
│   └── src/
│       ├── api/                 # API 客户端
│       ├── components/          # UI 组件
│       │   └── AgentStudio/
│       │       ├── workstation/ # 10 个管理模块
│       │       ├── modals/      # 弹窗组件
│       │       └── sidebar/     # 侧边栏
│       ├── stores/              # Zustand 状态管理
│       ├── hooks/               # 自定义 Hooks
│       └── i18n/                # 国际化
├── backend/                     # Python 后端
│   ├── core/                    # 核心模块
│   │   ├── app.py               # FastAPI 入口 + 中间件
│   │   ├── infra/               # 基础设施（缓存/限流/密钥保险箱）
│   │   └── observability/       # 可观测性（7 模块）
│   ├── routers/                 # API 路由（19 模块）
│   ├── repository/              # 数据访问层（23 模块）
│   ├── orm/                     # ORM 模型（24 模块）
│   ├── graph/                   # 单 Agent 引擎（LangGraph ReAct）
│   ├── workflow/                # 多 Agent 引擎（DAG 工作流）
│   ├── tasks/                   # Celery 异步任务
│   └── streaming/               # 流式输出（Redis pub/sub）
├── tests/                       # 测试代码
│   ├── routers/                 # 路由测试
│   ├── repository/              # 数据层测试
│   ├── e2e/                     # 端到端测试
│   └── ...                      # 其他测试
├── docker/                      # Docker 编排
│   ├── compose.local.yml        # 本地开发
│   ├── compose.prod.yml         # 生产部署
│   └── compose.redis-ha.yml     # Redis 高可用
├── helm/                        # Kubernetes 部署配置
├── docs/                        # 文档
├── scripts/                     # 工具脚本
├── monitoring/                  # 监控配置
└── .github/workflows/           # CI/CD
```

---

## 架构设计

### 后端架构

```
请求 → RateLimit → Auth → RequestLog → CORS → CSP → FastAPI
                                                      ↓
                                              ┌───────────────┐
                                              │   Routers     │ 19 个 API 模块
                                              │   (HTTP)      │
                                              └───────┬───────┘
                                                      ↓
                                              ┌───────────────┐
                                              │  Repository   │ 数据访问层
                                              │   (Async)     │
                                              └───────┬───────┘
                                                      ↓
                                              ┌───────────────┐
                                              │   Database    │ PostgreSQL + Redis
                                              └───────────────┘
```

### 数据流（Agent 执行）

```
用户输入 → POST /api/runs → Celery 任务 → 图执行引擎
                                              ↓
                                    ┌─────────────────────┐
                                    │  SingleAgentGraph   │ 单 Agent ReAct
                                    │  或                  │
                                    │  DynamicTeamGraph   │ 多 Agent DAG
                                    └──────────┬──────────┘
                                               ↓
                                    StreamEmitter → Redis pub/sub → WebSocket → 前端
```

### 双引擎架构

**SingleAgentGraph（单 Agent）**
```
START → agent → [有 tool_calls?] → tools → agent → ... → END
```
- ReAct 模式：思考 → 行动 → 观察 → 思考
- DeepSeek reasoning_content 实时流式输出
- 支持 MCP 工具和 Skill 工具

**DynamicTeamGraph（多 Agent）**
```
PM → [generator] → [reviewer] → [reporter] → 输出
         ↓ fan-out          ↓ fan-in
    [frontend] [backend] [test]
```
- DAG 编排，支持并行执行
- 三种节点策略：Generator（生成）、Reviewer（审核）、Reporter（汇总）
- 可配置的团队工作流

---

## API 文档

启动后端后访问：

- **Swagger UI**: `http://localhost:8080/docs`
- **ReDoc**: `http://localhost:8080/redoc`
- **OpenAPI JSON**: `http://localhost:8080/openapi.json`

### 主要 API 端点

| 模块 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/api/auth` | login, register, refresh, forgot-password |
| 会话 | `/api/sessions` | 会话管理 + 记忆条目 |
| 运行 | `/api/runs` | Agent 运行生命周期 + 流式输出 |
| Agent | `/api/agents` | Agent 配置管理 |
| 团队 | `/api/teams` | 团队管理 + 成员操作 |
| 工作流 | `/api/workflows` | 工作流 DAG 配置 |
| 提示词 | `/api/prompts` | 提示词模板管理 |
| 工具 | `/api/tools` | 工具注册 + 沙箱测试 |
| MCP | `/api/mcps` | MCP 服务器配置 |
| Skills | `/api/skills` | Skill 管理 |
| 密钥 | `/api/keys` | Fernet 加密密钥保险箱 |
| 模型 | `/api/models` | 可用 LLM 模型列表 |

### Debug/Observability 端点

| 端点 | 说明 |
|------|------|
| `GET /api/debug/events?errors=1` | 最近错误事件 |
| `GET /api/debug/trace/{trace_id}` | 全链路追踪详情 |
| `GET /api/debug/errors` | 错误聚合报告 |
| `GET /api/debug/stats` | 事件统计 |
| `GET /api/debug/health` | 可观测性系统自检 |
| `GET /api/metrics` | Prometheus RED 指标 |

---

## 部署

### Docker Compose

```bash
# 本地开发（所有服务容器化）
docker compose -f docker/compose.local.yml up -d

# 生产部署
docker compose -f docker/compose.prod.yml up -d

# Redis 高可用
docker compose -f docker/compose.redis-ha.yml up -d
```

### Kubernetes (Helm)

```bash
helm install agent-studio ./helm
```

### CI/CD

GitHub Actions 自动运行：

| 阶段 | 内容 |
|------|------|
| 前端 | `typecheck → lint → build → test → coverage` |
| 后端 | `ruff → mypy → pytest → coverage → diff-coverage` |
| 安全 | `secrets-scan → container-scan → pip-audit → bandit` |
| 集成 | `integration (legacy + rbac)` |
| 部署 | 推送到 `main` 自动部署到生产环境 |

---

## 开发指南

### 代码质量

```bash
# 前端
npm run lint       # ESLint
npm run format     # Prettier
npm run typecheck  # TypeScript

# 后端
ruff check backend/    # Python lint
mypy backend/ --strict # 类型检查
```

### 测试

```bash
# 前端（1143 个测试用例）
cd frontend && npm test

# 后端（1837 个测试用例）
PYTHONPATH=. python3 -m pytest tests/ -v --tb=short --ignore=tests/e2e/

# 集成测试（需要 Docker）
PYTHONPATH=. AUTH_MODE=legacy CHECKPOINTER_BACKEND=memory \
  python3 -m pytest tests/e2e/test_e2e_full_flow.py -v --tb=short
```

### 测试覆盖率

| 指标 | 阈值 | 当前 |
|------|------|------|
| 后端代码覆盖率 | 89% | 96.12% |
| 前端测试通过率 | 100% | 100% (1143/1143) |
| 需求追溯覆盖率 | 80% | 92.3% |

### 启动前检查

```bash
PYTHONPATH=. python3 scripts/preflight.py
```

Preflight 验证环境变量、数据库连接、迁移状态、Redis、磁盘空间。

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [QUICKSTART.md](QUICKSTART.md) | 快速启动指南 |
| [AGENTS.md](AGENTS.md) | AI 导航入口（架构、CI/CD、流式架构） |
| [RUNBOOK.md](RUNBOOK.md) | 运维手册（部署、备份、监控、排障） |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南 |
| [SECURITY.md](SECURITY.md) | 安全策略 |
| [docs/database-erd.md](docs/database-erd.md) | 数据库 ERD |
| [docs/adr/](docs/adr/) | 架构决策记录 |

---

## License

[MIT](LICENSE)
