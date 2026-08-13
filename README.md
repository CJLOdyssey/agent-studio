<div align="center">
<a name="readme-top"></a>

# AgentStudio

> AI Agent 编排平台 — 配置、编排、运行多 Agent 工作流。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-1e3a5f?style=flat-square)](https://langchain-ai.github.io/langgraph/)

[![GitHub stars](https://img.shields.io/github/stars/CJLOdyssey/agent-studio?color=ffcb47&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/CJLOdyssey/agent-studio?color=8ae8ff&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/network/members)
[![GitHub issues](https://img.shields.io/github/issues/CJLOdyssey/agent-studio?color=ff80eb&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/issues)

</div>

<details>
<summary><kbd>目录</kbd></summary>

- [快速开始](#-快速开始)
- [功能特性](#-功能特性)
- [部署](#-部署)
- [支持](#-支持)
- [贡献](#-贡献)
- [License](#-license)

</details>

---

## 🚀 快速开始

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio
cp .env.example .env  # 填入 DEEPSEEK_API_KEY
docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d
```

访问 http://localhost:5173

### 混合模式（开发推荐）

数据库/中间件用容器，后端由 **systemd user service** 守护，前端本地热更：

```bash
# 1. 起 agent-studio-db (5432) + agent-studio-redis (6379)
docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d postgres redis

# 2. 后端：systemd user service 守护（后端端口 8091，独立于 ragbase 的 8081）
systemctl --user restart agent-studio-backend   # 重启后端
systemctl --user status  agent-studio-backend   # 查看状态
journalctl --user -u agent-studio-backend -f    # 实时日志
# 服务文件：~/.config/systemd/user/agent-studio-backend.service（已 enable，Restart=always 崩溃自动拉起）

# 3. 前端（vite proxy 指向 http://localhost:8091）
cd frontend && npm run dev
```

> 备用（无 systemd 环境）：`make dev-backend`（`scripts/dev/run-backend.sh`）。后端默认端口 8091；环境变量从 `backend/.env` 加载（`DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/backend`、`REDIS_URL=redis://localhost:6379/0`）。

---

## ✨ 功能特性

### 双引擎执行

| 引擎 | 场景 | 特点 |
|------|------|------|
| SingleAgentGraph | 单 Agent 对话 | ReAct 模式，思考链流式输出 |
| DynamicTeamGraph | 多 Agent 工作流 | DAG 编排，fan-out/fan-in 并行 |

### 工作台

团队、工作流、Agent、提示词、工具、MCP、Skills、监控、审计日志 — 10 个模块一站式管理。

### 关键能力

- 实时流式输出 — WebSocket + Redis pub/sub
- MCP 协议支持 — 接入 Model Context Protocol
- BYOK 密钥保险箱 — Fernet 加密存储
- RBAC 认证 — JWT + 角色权限
- 全链路可观测 — trace 追踪、Prometheus 指标

---

## 🏗 项目架构

```mermaid
graph TB
    subgraph Frontend["前端 (React 18 + Vite 6)"]
        WS[WebSocket Client]
        UI[WorkstationPage<br/>10-Module UI]
        API[API Client<br/>Axios + TanStack Query]
    end

    subgraph Backend["后端 (FastAPI + SQLAlchemy async)"]
        RTR[routers/ <br/>19 个路由模块]
        REP[repository/ <br/>25 个仓储模块]
        ORM[(ORM Models<br/>24 张表)]
        AUTH[Auth<br/>JWT + RBAC]
        OBS[Observability<br/>EventStore + Trace]
    end

    subgraph Engines["Agent 引擎 (LangGraph)"]
        SA[SingleAgentGraph<br/>ReAct + Tool Calling]
        DT[DynamicTeamGraph<br/>DAG 多 Agent 并行]
    end

    subgraph Infra["基础设施"]
        PG[(PostgreSQL<br/>pgvector)]
        RD[(Redis<br/>Pub/Sub + Cache)]
        CL(Celery Workers<br/>异步任务)
        KV[Key Vault<br/>Fernet 加密]
    end

    UI --> API
    UI --> WS
    API --> RTR
    RTR --> REP --> ORM
    RTR --> AUTH
    RTR --> Engines
    Engines --> CL
    Engines --> RD
    SA -.->|StreamEmitter| RD
    DT -.->|StreamEmitter| RD
    RD -.->|Redis Pub/Sub| WS
    REP --> KV
    OBS -.->|SQLite| OBS_DB[(event_store.db)]
```

---

## 🛳 部署

| 方式 | 说明 |
|------|------|
| Docker | `docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d` |
| 混合模式 | Docker PG/Redis + 本地热重载 |
| 生产部署 | `docker compose -f docker/compose.base.yml -f docker/compose.prod.yml up -d` |
| Kubernetes | `helm install agent-studio ./helm` |

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `REDIS_URL` | 是 | Redis 连接串 |
| `AUTH_SECRET` | 是 | JWT 签名密钥（≥32字符） |
| `SEED_ADMIN_PASSWORD` | 生产必填 | 初始管理员密码（仅首次启动 seed 时生效） |
| `KEY_VAULT_SECRET` | 是 | Fernet 加密密钥（≥32字符） |
| `OPENAI_API_KEY` | 选一 | DeepSeek 或 OpenAI API 密钥 |
| `OPENAI_BASE_URL` | 否 | 自定义 API 端点（默认 DeepSeek） |

### 默认账号

| 账号 | 角色 | 说明 |
|------|------|------|
| `admin@example.com` | admin | 种子管理员；密码默认 `admin123`（仅开发），**生产必须通过 `SEED_ADMIN_PASSWORD` 环境变量设置**，且只对首次启动生效 |

> ⚠️ 部署生产前务必设置 `SEED_ADMIN_PASSWORD`，并登录后立即修改密码。

---

## 💬 支持

- GitHub Issues: https://github.com/CJLOdyssey/agent-studio/issues
- 文档: [QUICKSTART.md](QUICKSTART.md)

---

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

---

## 📝 License

[MIT](LICENSE)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
