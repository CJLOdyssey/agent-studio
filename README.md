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
[![GitHub issues](https://img.shields.io/github/issues/CJLOdyssey/agent-studio?color=ff80eb&labelColor=black&style=flat-square)](https://github.com/CJLOdyssey/agent-studio/issues)

</div>

<details>
<summary><kbd>目录</kbd></summary>

- [快速开始](#-快速开始)
- [功能特性](#-功能特性)
- [架构](#-架构)
- [部署](#-部署)
- [License](#-license)

</details>

---

## 🚀 快速开始

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio
cp .env.example .env  # 编辑 .env，填入 DEEPSEEK_API_KEY
docker compose -f docker/compose.local.yml up -d
```

访问 http://localhost:5173

> 首次启动需运行迁移：`PYTHONPATH=. alembic upgrade head`

---

## ✨ 功能特性

### 双引擎执行

| 引擎 | 场景 | 特点 |
|------|------|------|
| SingleAgentGraph | 单 Agent 对话 | ReAct 模式，DeepSeek 思考链，流式输出 |
| DynamicTeamGraph | 多 Agent 工作流 | DAG 编排，fan-out/fan-in 并行 |

### 工作台（10 个管理模块）

| 分类 | 模块 |
|------|------|
| 核心资源 | 团队、工作流、Agent、提示词、输出约束 |
| 集成 | 工具、MCP、Skills |
| 运维 | 监控中心、审计日志 |

### 关键能力

- **实时流式输出** — WebSocket + Redis pub/sub，思考链实时推送
- **MCP 协议支持** — 接入 Model Context Protocol 服务器
- **BYOK 密钥保险箱** — Fernet 加密存储，用户自带 API 密钥
- **RBAC 认证** — JWT + 角色权限，login/register/forgot-password
- **全链路可观测** — 事件存储、trace 追踪、慢查询检测、Prometheus 指标
- **一键部署** — Docker Compose，4 个服务，一条命令

---

## 🏗 架构

```
用户 → Frontend (React) → Backend (FastAPI) → LangGraph → LLM (DeepSeek/OpenAI)
                              ↓
                        PostgreSQL + Redis
                              ↓
                        Celery Worker (异步执行)
```

**后端分层：**
```
Routers (19 API) → Repository (数据访问) → Database (PostgreSQL)
```

**双引擎：**
- SingleAgentGraph: `START → agent → [tool_calls?] → tools → agent → END`
- DynamicTeamGraph: `PM → [generator] → [reviewer] → [reporter] → 输出`

---

## 🛳 部署

### Docker（推荐）

```bash
# 本地开发
docker compose -f docker/compose.local.yml up -d

# 生产部署
docker compose -f docker/compose.prod.yml up -d
```

### Kubernetes

```bash
helm install agent-studio ./helm
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek API 密钥 |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `REDIS_URL` | 是 | Redis 连接串 |
| `AUTH_SECRET` | 是 | JWT 签名密钥（≥32字符） |
| `KEY_VAULT_SECRET` | 是 | Fernet 加密密钥（≥32字符） |

---

## 📝 License

[MIT](LICENSE)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->
[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
