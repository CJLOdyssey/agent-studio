# 📋 Anchored Summary — AgentStudio

> 最后更新: 2026-06-30 | Sisyphus Session

---

## Goal
修复生产环境 502 错误、聊天功能不可用、CI pipeline 全链路，统一本地与生产 Docker 配置，建立运维规范。

## 总体进展
- **生产环境**: ✅ 5/5 容器健康（backend/celery/frontend/postgres/redis）
- **CI**: ✅ 全部 5 job 通过（frontend-quality / backend-quality / integration x2 / docs-check / build-frontend）
- **Build & Deploy**: ✅ build-and-push + deploy 全通过
- **聊天功能**: ✅ 生产环境测试通过（DeepSeek API + LangGraph + AsyncCheckpointer 全链路）

---

## 已完成的修改

### 生产环境修复

| # | 修复 | 根因 | 关键文件 |
|---|------|------|---------|
| 1 | **502 Bad Gateway** | nginx DNS 缓存 backend IP，容器重建后 IP 变更 | 服务器 `nginx -s reload` |
| 2 | **SqliteSaver 不兼容 async** | 同步检查点 + `astream_events()` 异步操作不匹配 | `checkpoint.py` + `requirements.txt` |
| 3 | **Alembic 表名冲突** | `CheckpointDB.__tablename__` 与 langgraph 内部 `checkpoints` 表冲突 | `checkpoint.py` + 新增迁移 |
| 4 | **`asyncio.run()` 嵌套崩溃** | Celery worker 已有事件循环，嵌套调用 `asyncio.run()` 报错 | `checkpoint.py`、`agent_graph.py`、`tasks.py`、`main.py` |
| 5 | **Celery 镜像未更新** | `build-push-action` 复用缓存层导致 `celery:latest` 标签陈旧 | `compose.prod.yml`、`compose.local.yml` |
| 6 | **CI checkpoint 3 测试失败** | 测试用 sync API 操作 async checkpointer，事件循环已关闭 | `tests/test_checkpoint_persistence.py` |

### 容器配置统一

| 项目 | 修改 |
|------|------|
| Celery 镜像 | 本地 + 生产统一指向 `backend:latest`（同一 Dockerfile） |
| `VITE_API_BASE_URL` | 默认值与生产一致 |
| Celery loglevel | 统一使用 `${LOG_LEVEL:-info}` |
| `extra_hosts` | 移除（frontend 用 nginx → `backend:8080`，不需要 `host.docker.internal`） |

### DevOps 规范

| 文件 | 变更 |
|------|------|
| `.github/workflows/deploy.yml` | SSH/SCP 步骤前添加醒目安全警告注释 |
| `docs/project/fix-logs/fix-log-2026-06-30-*.md` | 6 份修复日志（RCA 格式） |

### 架构设计决策

- **Async checkpointer 工厂模式**: `create_checkpointer()`（同步包装器） + `create_checkpointer_async()`（async 版本），按调用上下文选择合适的入口
- **构造器注入**: `SingleAgentGraph` / `TeamGraph` 接受可选 `checkpointer` 参数，由调用方决定创建方式
- **同一镜像标签**: celery 与 backend 共用同一镜像标签，避免 ACR 多标签同步不一致

### CI 状态

```
CI (main)
  frontend-quality  ✅ tsc → lint → build → test
  backend-quality   ✅ ruff → mypy → pytest (84 tests, 3 checkpoint tests fixed)
  integration       ✅ legacy + rbac E2E
  docs-check        ✅
  build-frontend    ✅

Build & Deploy
  build-and-push    ✅ backend + celery + frontend
  deploy            ✅ pull → up --force-recreate
```

---

## 未解决问题
- **`StreamEmitter._pending_thinking`** — `test_conversation.py` 中 2 个 pre-existing 测试失败，非本次改动导致
- **`test_postgres_backend_optional`** — 本地跳过（`libpq` 未安装），CI 中同样跳过

---

## 关键文件索引

| 文件路径 | 说明 |
|----------|------|
| `virtual_team/checkpoint.py` | Async 检查点工厂（`create_checkpointer` + `create_checkpointer_async`） |
| `virtual_team/agent_graph.py` | Agent Graph 引擎（接受 injectable checkpointer） |
| `virtual_team/tasks.py` | Celery 任务（使用 `await create_checkpointer_async()`） |
| `virtual_team/tests/test_checkpoint_persistence.py` | 修复后的 async checkpoint 测试 |
| `docker/compose.local.yml` | 本地 Docker Compose（与生产对齐） |
| `docker/compose.prod.yml` | 生产 Docker Compose（celery 用 backend 镜像） |
| `.github/workflows/deploy.yml` | 部署工作流（含 SSH 安全警告） |
| `docs/project/fix-logs/` | 本次 6 份修复日志 |line 解析 agent 配置绑定工具） |
| `virtual_team/routers/agents.py` | Agent API 路由（含 _parse_json 修复） |
| `virtual_team/repository/agents.py` | Agent 数据访问层 |
| `virtual_team/repository/tools.py` | 注册工具 CRUD（含 get_tools） |
| `virtual_team/repository/mcps.py` | MCP CRUD（含 get_mcps） |
| `virtual_team/repository/skills.py` | Skills CRUD（含 get_skills） |
| `frontend/src/components/devagents/` | 前端工作站模块 |
| `scripts/fix_playwright_libs.sh` | Playwright 系统库修复脚本 |

---

## 命令备忘录
```bash
# API E2E 测试
PYTHONPATH=. python3 -m pytest virtual_team/tests/test_e2e_full_flow.py -v --tb=short

# 全部后端测试
PYTHONPATH=. python3 -m pytest virtual_team/tests/ -v --tb=short

# 前端 E2E 测试
export LD_LIBRARY_PATH=/tmp/playwright-libs/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH
timeout 90 python3 scripts/test_e2e_frontend.py

# Docker 部署
docker compose -f docker-compose.local.yml build --no-cache backend
docker compose -f docker-compose.local.yml up -d --force-recreate backend
```
