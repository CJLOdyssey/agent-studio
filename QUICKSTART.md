# 🚀 快速启动指南

完整跑起整个项目（前端 + 后端 + 数据库 + Redis）只需要 **Docker compose** 一种方式。

---

## 🐳 完整启动（推荐）

> 一行命令跑起全部服务，无需手动安装 Node.js / Python / PostgreSQL / Redis。

### 前置条件

- Docker
- Docker Compose

### 启动

```bash
# 本地开发环境
docker compose -f docker/compose.local.yml up -d
```

或拉取远程镜像部署生产环境：

```bash
# 云服务器 / 生产环境
docker compose -f docker/compose.prod.yml pull
docker compose -f docker/compose.prod.yml up -d --force-recreate
```

### 两种配置对比

| 项目 | `compose.local.yml` | `compose.prod.yml` |
|------|-------------------|-------------------|
| 镜像来源 | 本地构建 | 远程仓库拉取 |
| 后端端口 | 暴露 8080 | 仅容器内访问 |
| 容器名前缀 | `virtual-team-*` | `virtual-team-*-prod` |

### 各服务访问地址

| 服务 | 本地 | 云服务器 |
|------|------|---------|
| 前端 | http://localhost:5173 | http://39.108.61.123/ |
| 后端 API | http://localhost:8080 | http://39.108.61.123:8080 |
| 后端健康检查 | http://localhost:8080/api/health | http://39.108.61.123:8080/api/health |
| PostgreSQL | localhost:5432 | 仅容器内 |
| Redis | localhost:6379 | 仅容器内 |

> 云服务器前端通过宿主机 nginx 反向代理 80 端口 → Docker 前端容器 5173。

---

## 🧩 组件入口

以下不是完整的项目启动方式，而是在开发或调试时需要单独运行的项目组成部分。

### 前端开发服务器

```bash
cd frontend && npm run dev
# → http://localhost:5173
```

需要后端 + PostgreSQL + Redis 已运行才能正常通信。

### 后端 API 服务器

```bash
PYTHONPATH=. python3 -m uvicorn virtual_team.app:app --reload
# → http://localhost:8080
```

需要 PostgreSQL + Redis 已运行。

### CLI 命令行

```bash
PYTHONPATH=. python3 -m virtual_team.main "<需求描述>"
```

单次执行 Agent 任务，需要 PostgreSQL + Redis 已运行，终端直接输出结果。

---

## ⚙️ 前置准备

### 环境变量

```bash
cp .env.example .env
# 编辑 .env，DEEPSEEK_API_KEY 必须配置才能获得 LLM 回复
```

### 依赖安装（本地开发时需要）

```bash
# 前端
cd frontend && npm install

# 后端
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```
