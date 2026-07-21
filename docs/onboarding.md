# 新开发者入门指南

> 本指南帮助新加入的开发者快速了解 AgentStudio 项目并开始贡献代码。

## 环境要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Node.js | 22+ | 前端构建与开发 |
| Python | 3.12+ | 后端运行 |
| Docker | latest | 数据库与容器化部署 |
| PostgreSQL | 16 (pgvector) | 主数据库 |
| Redis | 7+ | 缓存与消息队列 |

## 首次设置

### 1. 克隆并配置

```bash
git clone <repo-url> && cd agent-studio
cp .env.example .env
# 编辑 .env，至少配置 DEEPSEEK_API_KEY
```

### 2. 安装依赖

```bash
cd frontend && npm install && cd ..
pip install -r requirements.txt
```

### 3. 启动服务

推荐**混合模式**（热更新）：

```bash
# 启动 PostgreSQL 和 Redis
docker compose -f docker/compose.local.yml up -d postgres redis

# 启动后端（端口 8081）
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/backend \
PYTHONPATH=. uvicorn backend.core.app:app --reload --port 8081

# 启动前端（端口 5174）
cd frontend && VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port 5174
```

**重要**：后端命令必须设置 `PYTHONPATH=.`。

## 项目结构

```
agent-studio/
├── frontend/              # React 18 + Vite 6 + Tailwind 3
│   └── src/
│       ├── modules/       # 功能模块（agent/, prompt/, team/ 等）
│       ├── stores/        # Zustand 全局状态
│       └── hooks/         # TanStack Query hooks
├── backend/               # FastAPI + SQLAlchemy async
│   ├── core/              # app.py, config.py, database.py
│   ├── routers/           # API 路由（19 个模块）
│   ├── repository/        # 数据访问层（23 个模块）
│   └── orm/               # ORM 模型（24 个）
├── docker/                # Docker 配置
├── alembic/               # 数据库迁移
└── tests/                 # 后端测试
```

## 常用命令

### 前端（在 `frontend/` 目录下）

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint 代码检查 |
| `npm test` | Vitest 单元测试 |

### 后端（在项目根目录）

| 命令 | 说明 |
|------|------|
| `PYTHONPATH=. uvicorn backend.core.app:app --reload` | 启动开发服务器 |
| `PYTHONPATH=. ruff check backend/` | Ruff 代码检查 |
| `PYTHONPATH=. mypy backend/ --strict` | Mypy 类型检查 |
| `PYTHONPATH=. python3 -m pytest tests/ -v` | 运行测试 |
| `PYTHONPATH=. alembic upgrade head` | 执行数据库迁移 |

## 验证环境

1. 访问前端：`http://localhost:5174`
2. 检查后端：`http://localhost:8081/api/health`
3. 运行测试：`cd frontend && npm test` + `PYTHONPATH=. python3 -m pytest tests/ -v`

## 代码规范要点

- **前端**：TypeScript strict，禁止 `as any`/`@ts-ignore`，CSS 使用 `wsta-*` 前缀
- **后端**：三层架构 `database.py → repository/ → routers/`，异步优先，Ruff + Mypy strict
- **提交**：[Conventional Commits](https://www.conventionalcommits.org/) 格式
- **分支**：`feat/xxx`、`fix/xxx`、`docs/xxx` 等命名规范

## 深入阅读

| 文档 | 内容 |
|------|------|
| [AGENTS.md](../AGENTS.md) | 架构详解、技术选型、数据库 ERD |
| [RUNBOOK.md](../RUNBOOK.md) | 运维手册、故障排查、监控告警 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献流程、代码规范、PR 模板 |
| [docs/adr/](./adr/) | 架构决策记录（LangGraph、Celery 等） |
| [docs/database-erd.md](./database-erd.md) | 数据库表结构与关系图 |

## 常见问题

**Q: 后端启动报 `ModuleNotFoundError`**
A: 确保在项目根目录执行，且设置 `PYTHONPATH=.`。

**Q: 前端无法连接后端**
A: 检查 `VITE_API_BASE_URL` 是否指向正确的后端地址。

**Q: 数据库迁移失败**
A: 确保 PostgreSQL 已启动，且 `.env` 中 `DATABASE_URL` 正确。
