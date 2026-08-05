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

docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d
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
>
> **⚠️ 后端启动请始终使用 `make dev-backend`，不要手敲 `uvicorn`。**
> 手敲会绕过端口检测 + pidfile 防护，可能产生孤儿进程导致 CPU 过载。

```bash
# ① 启动数据库
docker compose -f docker/compose.base.yml -f docker/compose.local.yml up -d postgres redis

# ② 复制环境变量
cp .env.example .env
# 编辑 .env，确保 DEEPSEEK_API_KEY 已配置
# DATABASE_URL 和 REDIS_URL 指向 localhost 默认端口即可
# 可观测性系统默认开启（OBSERVABILITY_ENABLED=1），磁盘低于 100MB 自动停止写入

# ③ 后端 API（端口 8081，热更新）— 推荐方式
make dev-backend
# 或指定端口：PORT=8082 make dev-backend

# ④ 前端开发服务器（端口 5174，热更新）
cd frontend && VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port 5174
# → http://localhost:5174
```

### 启动问题排查

```bash
# 健康检查（含 CPU 时间 + 孤儿进程扫描）
make health PORT=8081

# 查看端口占用
ss -tlnp | grep -E "808[0-9]"

# 查找孤儿进程（PPID=1 的 python 进程）
ps --ppid 1 -o pid,%cpu,etime,args | grep python

# 查看后端日志
make dev-backend-logs

# 强制清理端口
fuser -k 8081/tcp
```

---

## 3. ☁️ 云 Docker（生产部署）

> 部署到远程服务器。

```bash
docker compose -f docker/compose.base.yml -f docker/compose.prod.yml pull
docker compose -f docker/compose.base.yml -f docker/compose.prod.yml up -d --force-recreate
```

| 服务 | 地址 |
|------|------|
| 前端 | https://your-domain.com/ |
| 后端 API | https://your-domain.com:8080 |

---

## ⚙️ 注意事项

- 混合模式启动前需先安装依赖：`cd frontend && npm install` + `pip install -r requirements.txt`
- 代理配置：前端 Vite 开发服务器通过 `VITE_API_BASE_URL` 指定后端地址；生产环境通过 nginx 反向代理
