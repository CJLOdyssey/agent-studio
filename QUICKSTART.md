# 🚀 快速启动指南

项目有三种启动方式，每种使用不同的端口，一眼可区分。

| # | 方式 | 后端 | 前端 | 数据库 | Redis |
|---|------|------|------|--------|-------|
| 1 | 🐳 本地 Docker | **8080** | **5173** | Docker | Docker |
| 2 | 🔀 混合模式 | **8081** | **5174** | Docker | Docker |
| 3 | ☁️ 云 Docker | 远程 | 远程 | 远程 | 远程 |

---

## 1. 🐳 本地 Docker（全部容器化）

> 一行命令跑起全部服务，无需手动安装。

```bash
cp .env.example .env
# 编辑 .env，DEEPSEEK_API_KEY 必须配置

docker compose -f docker/compose.local.yml up -d
```

| 服务 | 访问地址 |
|------|---------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:8080 |
| 后端健康检查 | http://localhost:8080/api/health |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## 2. 🔀 混合模式（Docker 数据库 + 本地代码）

> Docker 跑 PostgreSQL 和 Redis，后端 + 前端在本机运行，享受热更新。

```bash
# ① 启动数据库
docker compose -f docker/compose.local.yml up -d postgres redis

# ② 复制环境变量
cp .env.example .env
# 编辑 .env，确保 DEEPSEEK_API_KEY 已配置
# DATABASE_URL 和 REDIS_URL 指向 localhost 默认端口即可

# ③ 后端 API（端口 8081，热更新）
PYTHONPATH=. uvicorn virtual_team.app:app --reload --port 8081
# → http://localhost:8081

# ④ 前端开发服务器（端口 5174，热更新）
cd frontend && VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port 5174
# → http://localhost:5174
```

---

## 3. ☁️ 云 Docker（生产部署）

> 部署到远程服务器。

```bash
docker compose -f docker/compose.prod.yml pull
docker compose -f docker/compose.prod.yml up -d --force-recreate
```

| 服务 | 地址 |
|------|------|
| 前端 | https://your-domain.com/ |
| 后端 API | https://your-domain.com:8080 |

---

## ⚙️ 注意事项

- 混合模式启动前需先安装依赖：`cd frontend && npm install` + `pip install -r requirements.txt`
- 代理配置：前端 Vite 开发服务器通过 `VITE_API_BASE_URL` 指定后端地址；生产环境通过 nginx 反向代理
