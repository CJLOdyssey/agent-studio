# AgentStudio

> AI Agent 协作系统 — 通过配置多种 AI Agent 组建虚拟团队，完成复杂软件项目。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://www.python.org/)

---

## 目录

- [概述](#概述)
- [功能](#功能)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发](#开发)
- [部署](#部署)
- [API 文档](#api-文档)

---

## 概述

AgentStudio 是一个基于 AI Agent 的智能协作平台。用户可以通过配置不同角色的 AI Agent（产品经理、前端工程师、后端工程师、测试工程师），让它们协同完成软件项目。支持 DAG 工作流编排、实时流式输出、全链路可观测性。

**核心能力：**

- **多 Agent 协作** — 多个 AI Agent 按角色分工，通过 LangGraph 编排协同工作
- **DAG 工作流** — 可视化拖拽编辑器 + 动态图执行引擎，支持 fan-out/fan-in 并行
- **全链路可观测** — 内置事件存储、trace 追踪、慢查询检测、自诊断端点
- **灵活扩展** — 自定义 Agent 角色/提示词/工具/MCP/Skills，版本管理

---

## 功能

### Agent 管理
创建和配置 AI Agent，自定义系统提示词、输出约束、绑定工具链。支持版本管理和变更对比。

### 提示词管理
创建、编辑、分类提示词，支持导入导出和版本追踪。

### 工具链
管理内置工具和 MCP 服务器，绑定到 Agent 的执行链中。支持自定义 Skill 的安装和管理。

### 工作流引擎
- **可视化 DAG 编辑器** — 基于 React Flow，拖拽式设计工作流
- **动态图执行** — 基于 LangGraph，支持 generator/reviewer/reporter 策略
- **实时流式输出** — DeepSeek reasoning_content 实时推送思考链
- **持久化** — 工作流 CRUD，一键保存和删除

### 团队协作
创建团队分组，一键触发多 Agent 协同工作流。PM → 前端 → 后端 → 测试 自动循环。

### 可观测性
内置完整的可观测性系统：

| 能力 | 说明 |
|------|------|
| **事件存储** | SQLite 本地存储，后台批量写入，零阻塞 |
| **全链路追踪** | trace_id 贯穿 HTTP → 后端 → DB → LLM 调用 |
| **自诊断** | `GET /api/debug/health` 暴露写入错误、队列积压、磁盘状态 |
| **错误分析** | 自动聚合 trace 内错误，给出根因建议 |
| **慢查询检测** | SQLAlchemy 事件监听，>500ms 自动告警 |
| **磁盘保护** | 低于阈值自动停止写入 |
| **启动守卫** | 进程 marker + crash 日志，异常崩溃可追溯 |

### 用户认证
支持 JWT Token 鉴权 + RBAC 角色控制（admin/member）。提供 login/register/forgot-password 完整流程。

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| TypeScript | 5.6 | 类型系统 |
| Vite | 6.0 | 构建工具 |
| Tailwind CSS | 3.4 | 样式 |
| Zustand | 5.0 | 状态管理 |
| React Query | 5.100 | 数据获取 |
| React Flow | 11.x | 工作流 DAG 编辑器 |
| React Router | 6.28 | 路由 |
| i18next | 26.3 | 国际化 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.12 | 运行时 |
| FastAPI | 0.110 | Web 框架 |
| LangGraph | 0.2 | AI Agent 编排 |
| SQLAlchemy | 2.0 | ORM |
| PostgreSQL | 16 | 数据库 |
| Redis | 7.2 | 缓存/消息队列 |
| Celery | 5.6 | 异步任务 |

---

## 快速开始

> 完整启动指南（本地开发 / Docker / CLI）见 [QUICKSTART.md](QUICKSTART.md)。

### 环境要求

- Node.js >= 20.0 / Python >= 3.12
- PostgreSQL >= 16 / Redis >= 7.2
- Docker（可选，用于容器化部署）

### 安装

```bash
git clone https://github.com/CJLOdyssey/agent-studio.git
cd agent-studio

# 前端依赖
cd frontend && npm install && cd ..

# 后端依赖
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 环境变量
cp .env.example .env
# 编辑 .env，配置 DEEPSEEK_API_KEY
```

### 启动

```bash
# 终端 1 — 前端
cd frontend && npm run dev

# 终端 2 — 后端
PYTHONPATH=. python3 -m uvicorn backend.app:app --reload
```

或 Docker 一键启动：

```bash
docker compose -f docker/compose.local.yml up -d
```

> **注意**：首次启动前需运行数据库迁移：`PYTHONPATH=. alembic upgrade head`

---

## 项目结构

```
AgentStudio/
├── AGENTS.md                    # AI 导航入口
├── CLAUDE.md                    # AI 行为规则
├── QUICKSTART.md                # 启动指南
├── frontend/                    # React 前端
│   └── src/
│       ├── api/                 # API 客户端
│       ├── components/          # UI 组件
│       └── stores/              # 状态管理
├── backend/                # Python 后端
│   ├── app.py                   # FastAPI 入口 + 生命周期
│   ├── routers/                 # API 路由（18 模块）
│   ├── repository/              # 数据访问层
│   ├── observability/           # 可观测性（7 模块）
│   └── tasks/                   # Celery 任务
├── docker/                      # Docker 编排
├── scripts/                     # 工具脚本
│   └── preflight.py             # 启动前检查脚本
└── .github/workflows/           # CI/CD
```

详细模块映射见 [docs/module-map.md](docs/module-map.md)。

---

## 开发

### 代码质量

```bash
# 前端
npm run lint       # ESLint
npm run format     # Prettier
npm run typecheck  # TypeScript

# 后端
ruff check backend/   # Python lint
mypy backend/ --strict # 类型检查
```

### 测试

```bash
# 前端（228 个测试用例，32 个测试文件）
cd frontend && npm test

# 后端（170 个测试用例）
PYTHONPATH=. python3 -m pytest tests/ -v --tb=short --ignore=tests/e2e/

# 集成测试（需要 Docker）
PYTHONPATH=. AUTH_MODE=legacy CHECKPOINTER_BACKEND=memory \
  python3 -m pytest tests/e2e/test_e2e_full_flow.py -v --tb=short
```

### 启动前检查

```bash
PYTHONPATH=. python3 scripts/preflight.py
```

Preflight 验证环境变量、数据库连接、迁移状态、Redis、磁盘空间，在启动前暴露配置问题。

---

## 部署

### Docker

```bash
# 本地开发
docker compose -f docker/compose.local.yml up -d

# 生产部署
docker compose -f docker/compose.prod.yml up -d
```

### CI/CD

GitHub Actions 自动运行：`typecheck → lint → build → test`（前端）/ `ruff → mypy → pytest`（后端）。提交到 `main` 自动部署。

---

## API 文档

启动后端后访问：

- Swagger UI: `http://localhost:8080/docs`
- ReDoc: `http://localhost:8080/redoc`
- OpenAPI JSON: `http://localhost:8080/openapi.json`

### Debug 端点

| 端点 | 说明 |
|------|------|
| `GET /api/debug/events?errors=1` | 最近错误事件 |
| `GET /api/debug/trace/{trace_id}` | 全链路追踪详情 |
| `GET /api/debug/errors` | 错误聚合报告 |
| `GET /api/debug/stats` | 事件统计 |
| `GET /api/debug/health` | 可观测性系统自检 |
