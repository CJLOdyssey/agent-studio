<div align="center">
<a name="readme-top"></a>

# AgentStudio

> AI Agent 编排平台 — 支持单 Agent 对话和多 Agent DAG 工作流，可自定义角色、提示词、工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-1e3a5f?style=flat-square)](https://langchain-ai.github.io/langgraph/)

[![GitHub stars](https://img.shields.io/github/stars/CJLOdyssey/agent-studio?color=ffcb47&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/CJLOdyssey/agent-studio?color=8ae8ff&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/network/members)
[![GitHub issues](https://img.shields.io/github/issues/CJLOdyssey/agent-studio?color=ff80eb&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/issues)
[![GitHub contributors](https://img.shields.io/github/contributors/CJLOdyssey/agent-studio?color=c4f042&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/graphs/contributors)

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [👋 Getting Started](#-getting-started)
- [✨ Features](#-features)
- [🏗 Architecture](#-architecture)
- [📦 Tech Stack](#-tech-stack)
- [🚀 Self Hosting](#-self-hosting)
- [⌨️ Local Development](#️-local-development)
- [🤝 Contributing](#-contributing)
- [📝 License](#-license)

</details>

---

## 👋 Getting Started

AgentStudio 是一个 AI Agent 编排平台。用户可以创建和配置 AI Agent，自定义角色、提示词、工具，支持单 Agent 对话和多 Agent DAG 工作流。

**核心能力：**

- **多 Agent 协作** — 多个 AI Agent 按角色分工，通过 LangGraph 编排协同工作
- **DAG 工作流** — 可视化拖拽编辑器 + 动态图执行引擎，支持 fan-out/fan-in 并行
- **实时流式输出** — DeepSeek reasoning_content 实时推送思考链
- **全链路可观测** — 内置事件存储、trace 追踪、慢查询检测、自诊断端点
- **灵活扩展** — 自定义 Agent 角色/提示词/工具/MCP/Skills，版本管理
- **BYOK 密钥保险箱** — Fernet 加密存储，用户自带 API 密钥
- **RBAC 认证** — JWT + 角色权限控制，login/register/forgot-password 完整流程

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✨ Features

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

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🏗 Architecture

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

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3 | UI framework |
| TypeScript | 5.6 | Type system (strict mode) |
| Vite | 6.0 | Build tool |
| Tailwind CSS | 3.4 | Styling |
| Zustand | 5.0 | UI/chat state management |
| TanStack Query | 5.100 | Server data fetching |
| React Flow | 11.x | Visual workflow DAG editor |
| React Router | 6.28 | Client-side routing |
| i18next | 26.3 | Internationalization (zh-CN primary) |

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12 | Runtime |
| FastAPI | 0.110 | Web framework |
| LangGraph | 0.2 | AI Agent orchestration (dual engine) |
| SQLAlchemy | 2.0 | Async ORM |
| PostgreSQL | 16 + pgvector | Primary database |
| Redis | 7.2 | Cache, pub/sub, message queue |
| Celery | 5.6 | Background task execution |
| Alembic | — | Database migrations |
| Fernet | — | Key vault encryption |
| Prometheus | — | Metrics collection |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker / Docker Compose | Containerization |
| nginx | Frontend reverse proxy (production) |
| GitHub Actions | CI/CD (10-job pipeline) |
| Alibaba Cloud ACR | Container registry (production) |
| Helm | Kubernetes deployment |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🚀 Self Hosting

### Docker (Recommended)

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio

# Start all services
docker compose -f docker/compose.local.yml up -d

# View logs
docker compose -f docker/compose.local.yml logs -f
```

Access http://localhost:5173

### Production

```bash
docker compose -f docker/compose.prod.yml up -d
```

### Kubernetes (Helm)

```bash
helm install agent-studio ./helm
```

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql+asyncpg://user:pass@localhost:5432/db` |
| `REDIS_URL` | Yes | Redis connection string | `redis://localhost:6379/1` |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key | `sk-xxxxxx` |
| `AUTH_SECRET` | Yes | JWT signing secret (min 32 chars) | `your-secret-key` |
| `KEY_VAULT_SECRET` | Yes | Fernet encryption key (min 32 chars) | `your-encryption-key` |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ Local Development

### Prerequisites

- Node.js >= 20.0
- Python >= 3.12
- PostgreSQL >= 16
- Redis >= 7.2

### Setup

```bash
# Clone
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio

# Frontend
cd frontend && npm install && npm run dev

# Backend (new terminal)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Edit .env, configure DEEPSEEK_API_KEY
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python3 -m uvicorn backend.core.app:app --reload --port 8080
```

Access http://localhost:5173

### Testing

```bash
# Frontend (1143 tests)
cd frontend && npm test

# Backend (1837 tests)
PYTHONPATH=. python3 -m pytest tests/ -v --tb=short --ignore=tests/e2e/

# E2E (requires Docker)
PYTHONPATH=. AUTH_MODE=legacy CHECKPOINTER_BACKEND=memory \
  python3 -m pytest tests/e2e/test_e2e_full_flow.py -v --tb=short
```

### Code Quality

```bash
# Frontend
npm run lint       # ESLint
npm run format     # Prettier
npm run typecheck  # TypeScript

# Backend
ruff check backend/    # Python lint
mypy backend/ --strict # Type check
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤝 Contributing

Contributions of all types are more than welcome! If you are interested in contributing code, feel free to check out our GitHub [Issues](https://github.com/CJLOdyssey/agent-studio/issues) and [Pull Requests](https://github.com/CJLOdyssey/agent-studio/pulls).

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
