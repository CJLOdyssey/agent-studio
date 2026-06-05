# 部署方案

> 适用版本：2026-06 · ACR 镜像仓库 + 单机 Docker Compose + GitHub Actions 自动化部署

---

## 目录

1. [架构总览](#1-架构总览)
2. [基础设施](#2-基础设施)
3. [CI 流水线](#3-ci-流水线)
4. [部署流水线](#4-部署流水线)
5. [快速上手](#5-快速上手)
6. [运维指南](#6-运维指南)
7. [故障处理](#7-故障处理)

---

## 1. 架构总览

```
┌─ 开发者: git push origin main ──────────────────────────────────┐
│                                                                  │
│  GitHub                                                         │
│    ├── CI (ubuntu-latest)                                       │
│    │   ├── 后端测试 (Py 3.12)                                    │
│    │   ├── 代码检查 (Ruff + mypy + bandit)                      │
│    │   ├── 集成测试 (PostgreSQL + Redis)                        │
│    │   └── 前端检查 (ESLint + TypeScript + Vitest)              │
│    │                                                           │
│    └── Deploy                                                   │
│        ├── Job 1: CI Gate → 查询 CI 状态                        │
│        ├── Job 2: Build & Push → ACR 本地仓库 (ubuntu-latest)  │
│        └── Job 3: Deploy → ECS (self-hosted runner)            │
│                                                                  │
│  ACR (阿里云容器镜像服务)                                       │
│    └── 本地仓库: virtual-team:latest                            │
│                                                                  │
│  ECS (阿里云)                                                   │
│    └── Docker Compose (5 services)                              │
│        ├── nginx (frontend)  ← 端口 80                          │
│        │   ├── /api/* → api:8080                                │
│        │   ├── /ws/*  → api:8080 (WebSocket)                   │
│        │   └── /*     → SPA index.html                          │
│        ├── api ← ACR 镜像 (FastAPI + Uvicorn :8080)            │
│        ├── celery_worker ← ACR 镜像 (AI Agent 异步任务)        │
│        ├── postgres (pgvector/pg16)                             │
│        └── redis (7-alpine)                                     │
└──────────────────────────────────────────────────────────────────┘
```

**核心流程：** 一次 `git push main` → CI 质量门禁 → CI Gate（GitHub API 确认 CI 通过）→ Docker 镜像构建 + 推送到 ACR → ECS 拉取镜像 + 滚动重启。

---

## 2. 基础设施

### 2.1 服务器

| 项 | 值 |
|---|---|
| 云厂商 | 阿里云 ECS |
| 操作系统 | Linux |
| 运行时 | Docker + Docker Compose V2 |
| GitHub Runner | 自托管 (self-hosted)，注册为系统服务 |
| 项目路径 | `/home/odyssey/actions-runner/_work/virtual-software-team/virtual-software-team` |
| 备份项目路径 | `/opt/virtual-team`（手动部署用） |

Runner 由 `scripts/setup-runner.sh` 安装，使用 ghproxy 加速国内下载。

### 2.2 服务组成

#### 2.2.1 PostgreSQL (`virtual-team-db`)

- **镜像：** `pgvector/pgvector:pg16`
- **端口：** `5432:5432`
- **数据卷：** `pgdata`（持久化）
- **健康检查：** `pg_isready -U postgres`（5s 间隔）
- **用途：** 主数据库（含 pgvector 向量插件，用于 RAG 语义搜索）

#### 2.2.2 Redis (`virtual-team-redis`)

- **镜像：** `redis:7-alpine`
- **端口：** `6379:6379`
- **健康检查：** `redis-cli ping`（5s 间隔）
- **用途：** Celery 消息队列 / 结果后端 / 缓存

#### 2.2.3 API (`virtual-team-api`)

- **镜像：** `registry.cn-shenzhen.aliyuncs.com/${ACR_NAMESPACE}/virtual-team:latest`
- **端口：** `8080:8080`
- **启动命令：** `uvicorn virtual_team.app:app --host 0.0.0.0 --port 8080`
- **健康检查：** `GET /api/health`（30s 间隔）
- **依赖：** postgres + redis 健康后才启动
- **关键环境变量：** `DEEPSEEK_API_KEY`, `OPENAI_BASE_URL`, `DATABASE_URL`, `REDIS_URL`, `KEY_VAULT_SECRET`

#### 2.2.4 Celery Worker (`virtual-team-worker`)

- **镜像：** 与 API 共用同一 ACR 镜像
- **启动命令：** `celery -A virtual_team.broker.celery_app worker --loglevel=info --concurrency=2`
- **健康检查：** `celery inspect ping`
- **依赖：** Redis 健康后才启动
- **用途：** 执行 AI Agent 团队的异步任务

#### 2.2.5 Nginx 前端 (`virtual-team-frontend`)

- **镜像：** `nginx:alpine`
- **端口：** `${PORT:-80}:80`
- **卷挂载：**
  - `./frontend/dist:/usr/share/nginx/html:ro`（静态资源）
  - `./nginx.conf:/etc/nginx/conf.d/default.conf:ro`（配置）
- **路由规则（详见 `nginx.conf`）：**

| 路径 | 目标 | 特性 |
|---|---|---|
| `/api/*` | `proxy_pass api:8080` | HTTP 反向代理 |
| `/ws/*` | `proxy_pass api:8080` | WebSocket 升级支持 |
| `/assets/*` | 本地静态文件 | `expires 1y; immutable`（强缓存） |
| `/*.html` | 本地静态文件 | `no-cache` |
| `/` (其他) | `try_files → index.html` | SPA 路由回退 |

### 2.3 Docker 镜像构建策略（多阶段构建）

详见 `Dockerfile`：

```
Stage 1: frontend-builder (node:20-alpine)
  ├── npm ci
  ├── vite build
  └── → frontend/dist/

Stage 2: python-deps (python:3.12-slim)
  ├── pip install -r requirements.txt
  └── → /usr/local/lib/python3.12/site-packages/

Stage 3: runtime (python:3.12-slim)
  ├── site-packages (从 Stage 2 复制)
  ├── virtual_team/ 源码
  ├── frontend/dist (从 Stage 1 复制)
  ├── entrypoint.sh (密钥自动预配)
  ├── HEALTHCHECK → /api/health
  └── CMD: uvicorn virtual_team.app:app --port 8080
```

**特点：**
- 前端在容器内构建，宿主无需 Node.js
- Python 依赖层单独缓存，减少重复构建时间
- 运行镜像仅包含运行时所需，体积小

### 2.4 密钥管理（entrypoint.sh）

容器启动时自动处理 `KEY_VAULT_SECRET`：

1. 如果环境变量已设置 → 直接使用
2. 如果未设置，但 `/secrets/key_vault_secret` 文件存在 → 从文件读取
3. 如果都不存在 → `secrets.token_hex(32)` 生成新密钥并写入共享卷

**效果：** 首次启动自动初始化密钥，后续重启从卷中读取，保证密钥持久化。

### 2.5 数据卷

| 卷名 | 挂载点 | 用途 |
|---|---|---|
| `pgdata` | `/var/lib/postgresql/data` | 数据库持久化 |
| `secrets` | `/secrets` | 加密密钥持久化 |

### 2.6 网络

- **名称：** `virtual-team-network`
- **所有服务在同一网络内，通过容器名互联**

---

## 3. CI 流水线

**文件：** `.github/workflows/ci.yml`
**触发条件：** push/PR 到 main 分支

| Job | 运行环境 | 内容 |
|---|---|---|
| `backend-test` | ubuntu-latest | pytest + coverage（Py 3.12） |
| `backend-lint` | ubuntu-latest | Ruff 代码检查 |
| `backend-typecheck` | ubuntu-latest | mypy 类型检查 |
| `backend-security` | ubuntu-latest | bandit 安全审计 |
| `backend-integration` | ubuntu-latest | 真实 PostgreSQL + Redis 集成测试 |
| `frontend-lint` | ubuntu-latest | ESLint + TypeScript 类型检查 |
| `frontend-test` | ubuntu-latest | Vitest 单元测试 + 覆盖率 |
| `build` | ubuntu-latest | Vite 生产构建验证 |
| `summary` | ubuntu-latest | CI 汇总（所有 job 依赖此 job） |

**并行策略：** 各 Job 独立并行运行，`backend-integration` 依赖 `backend-test`。

---

## 4. 部署流水线

**文件：** `.github/workflows/deploy.yml`
**触发条件：** push 到 main 分支（或手动 workflow_dispatch）

### Job 1: CI Gate

- **运行环境：** GitHub 托管 ubuntu-latest
- **步骤：**
  1. 通过 GitHub REST API 查询 CI 状态
  2. 检查所有 CI job 是否通过
  3. 如果 CI 失败或未完成，终止部署

### Job 2: Build & Push to ACR

- **运行环境：** GitHub 托管 ubuntu-latest
- **依赖：** Job 1 完成
- **步骤：**
  1. checkout 代码
  2. 设置 Docker Buildx
  3. 登录 ACR（使用 `secrets.ACR_USERNAME` + `secrets.ACR_PASSWORD`）
  4. 构建并推送镜像到 `registry.cn-shenzhen.aliyuncs.com/${{ secrets.ACR_NAMESPACE }}/virtual-team`：
     - `:latest` tag
     - `:{sha}` tag（commit SHA，用于回滚追溯）
  5. 使用 GitHub Actions 缓存加速后续构建

### Job 3: Deploy to Production

- **运行环境：** self-hosted（ECS 上的自托管 Runner）
- **依赖：** Job 2 完成
- **条件：** `if: success()`
- **步骤：**
  1. **登录 ACR：** 使用 `ACR_USERNAME` + `ACR_PASSWORD`
  2. **拉取代码：** `git fetch --depth=1 origin main` + `git reset --hard origin/main`
  3. **复制 .env：** 从固定路径复制环境变量文件
  4. **拉取 + 重启：**
     ```bash
     docker compose -p 7 pull                       # 拉取 ACR 镜像（api/celery_worker）
     docker compose -p 7 up -d --remove-orphans     # 启动/重启所有服务
     docker image prune -f                          # 清理旧镜像
     ```
  5. **通知：** 通过 Webhook 发送部署结果（支持飞书/钉钉等 markdown 消息）

**并发控制：** `concurrency: group: deploy` + `cancel-in-progress: false`，保证同一时间只有一个部署在进行。

**关键区别：**
- 镜像在 ACR 构建（Job 2），ECS 只负责拉取（Job 3）
- ECS 不再执行 `npm ci`、`npm run build`、`docker compose build`
- `docker-compose.yml` 中 `api` 和 `celery_worker` 使用 `image:` 而非 `build:`

### 手动部署

**文件：** `scripts/deploy.sh`

当 CI 不可用时（如 GitHub Actions 故障），可在 ECS 上直接执行：

```bash
# 首次部署
mkdir -p /opt/virtual-team
git clone <repo-url> /opt/virtual-team
cp scripts/deploy.sh /root/deploy.sh && chmod +x /root/deploy.sh
nano /opt/virtual-team/.env  # 写入配置
/root/deploy.sh

# 后续部署
/root/deploy.sh
```

手动脚本流程：`git pull` → `docker compose pull` → `docker compose up -d` → 清理旧镜像。

---

## 5. 快速上手

### 5.1 首次部署

```bash
# 1. 在 ECS 上安装 Docker + Docker Compose
apt-get install docker.io docker-compose-v2

# 2. 克隆项目
git clone https://github.com/CJLOdyssey/virtual-software-team.git /opt/virtual-team
cd /opt/virtual-team

# 3. 配置环境变量
cp .env.template .env
# 编辑 .env 填入 DEEPSEEK_API_KEY、DASHSCOPE_API_KEY、KEY_VAULT_SECRET

# 4. 登录 ACR（首次部署需要）
docker login registry.cn-shenzhen.aliyuncs.com -u <ACR_USERNAME>

# 5. 首次启动
docker compose up -d

# 6. 访问 http://<ECS-IP>
```

### 5.2 配置 GitHub Actions 部署

```bash
# 1. 在 ECS 上安装自托管 Runner
#    先到 GitHub Repo → Settings → Actions → Runners → 获取 Token
bash scripts/setup-runner.sh <TOKEN>

# 2. 配置环境变量
#    将 .env 放置在以下路径（deploy.yml 中引用的固定路径）：
#    /mnt/d/PyCharmProjects/Agent/projects/项目 7：虚拟软件外包团队/.env
#    或在 ECS 的工作目录下手动创建 .env

# 3. 配置 GitHub Secrets（在 GitHub Repo → Settings → Secrets → Actions）
#    - ACR_USERNAME: ACR 登录用户名
#    - ACR_PASSWORD: ACR 登录密码
#    - ACR_NAMESPACE: virtual-team（ACR 命名空间）

# 4. push main 触发自动部署
git push origin main
```

### 5.3 环境变量说明

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek（或兼容 OpenAI 的）API Key |
| `DASHSCOPE_API_KEY` | 是 | 阿里云 DashScope API Key（用于 Embedding） |
| `KEY_VAULT_SECRET` | 是 | 密钥保险库加密密钥（32 字节 hex） |
| `OPENAI_BASE_URL` | 否 | 兼容 OpenAI 的 API Base URL |
| `OPENAI_MODEL` | 否 | 模型名称（默认 `deepseek-chat`） |
| `LOG_LEVEL` | 否 | 日志级别（默认 `INFO`） |
| `PORT` | 否 | 前端端口（默认 `80`） |

---

## 6. 运维指南

### 6.1 常用命令

```bash
# 查看所有服务状态
docker compose ps

# 查看实时日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f api
docker compose logs -f celery_worker

# 重启某个服务
docker compose restart api

# 拉取最新镜像并重启
docker compose pull api celery_worker
docker compose up -d

# 停止所有服务
docker compose down

# 清理旧镜像
docker image prune -f

# 进入容器调试
docker exec -it virtual-team-api sh
docker exec -it virtual-team-db psql -U postgres -d virtual_team
```

### 6.2 健康检查

所有服务均配置了 healthcheck，可通过以下方式监控：

```bash
# 查看各服务健康状态
docker compose ps

# API 健康端点
curl http://localhost:8080/api/health
```

### 6.3 备份与恢复

```bash
# 数据库备份
docker exec virtual-team-db pg_dump -U postgres -d virtual_team > backup_$(date +%Y%m%d).sql

# 数据库恢复
cat backup_20260601.sql | docker exec -i virtual-team-db psql -U postgres -d virtual_team
```

### 6.4 查看 GitHub Actions 运行状态

- CI: https://github.com/CJLOdyssey/virtual-software-team/actions/workflows/ci.yml
- Deploy: https://github.com/CJLOdyssey/virtual-software-team/actions/workflows/deploy.yml

---

## 7. 故障处理

### 部署失败

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `docker compose pull` 失败 | ACR 登录凭证失效 | 检查 GitHub Secrets 中 ACR_USERNAME/ACR_PASSWORD |
| ACR 构建失败 | Dockerfile 语法错误 | 检查 CI 日志中的构建输出 |
| 容器启动后立即退出 | 环境变量缺失 | 检查 `.env` 文件是否存在且完整 |
| API 健康检查失败 | 数据库未就绪 | `docker compose logs postgres` 查看 |
| CI Gate 失败 | 上游 CI 未通过 | 检查 CI 状态，修复后重新触发部署 |

### 回滚部署

当前方案支持镜像版本回滚（ACR 保留历史镜像 tag）：

```bash
# 方式一：git revert 回退代码
git revert HEAD
git push origin main

# 方式二：手动指定旧版本镜像
cd /home/odyssey/actions-runner/_work/virtual-software-team/virtual-software-team
# 修改 .env 中 IMAGE_TAG 为旧 commit SHA
# 然后拉取并重启
docker compose pull api celery_worker
docker compose up -d
```

### Runner 故障

```bash
# 查看 Runner 状态
cd /opt/actions-runner
./svc.sh status

# 重启 Runner
./svc.sh restart

# 重新配置 Runner（如果 Token 失效）
./config.sh --url https://github.com/CJLOdyssey/virtual-software-team --token <NEW_TOKEN>
```

---

## 附：相关文件索引

| 文件 | 用途 |
|---|---|
| `Dockerfile` | 多阶段容器镜像构建 |
| `docker-compose.yml` | 服务编排定义 |
| `nginx.conf` | 前端反向代理配置 |
| `.env.template` | 环境变量模板 |
| `.dockerignore` | Docker 构建上下文排除 |
| `.github/workflows/ci.yml` | CI 流水线 |
| `.github/workflows/deploy.yml` | 部署流水线（ACR 构建 + ECS 拉取） |
| `scripts/deploy.sh` | 手动部署脚本 |
| `scripts/entrypoint.sh` | 容器启动入口（密钥预配） |
| `scripts/setup-runner.sh` | 自托管 Runner 安装脚本 |
| `docs/DEPLOYMENT.md` | 本文档 |
