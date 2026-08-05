# AgentStudio — AI 操作指南

## 快速启动后端（开发模式）

```bash
# 方式 1（推荐）— 自动端口检测 + pidfile 防多开 + 热更新
make dev-backend

# 方式 2 — 同上，指定端口
PORT=8082 make dev-backend

# 方式 3 — 手动（已弃用，后台可能残留孤儿进程）
PYTHONPATH=backend/src python -m uvicorn core.app:app --reload --port 8081
```

> **原则**: 始终用 `make dev-backend` 或 `bash scripts/dev/run-backend.sh` 启动。
> 启动脚本会先 `pkill -f "uvicorn.*core.app:app"` 杀掉所有已有实例，再启动新的。
> 手敲 `uvicorn` 会绕过这个杀旧逻辑，可能导致多个实例打架、CPU 过载。
>
> **⚠️ 不要加 `--reload`**。`--reload` 模式会触发 `multiprocessing.spawn`
> 子进程卡死（LangGraph 底层的已知问题）。默认不加 `--reload`。
> 非要热更新用 `make dev-backend-reload`，但风险自担。

## 启动问题排查

```bash
# 1. 健康检查（含 CPU 时间 + 孤儿进程扫描）
make health PORT=8081
# 或：python scripts/dev/health.py --port 8081 --check-orphans

# 2. 查看端口占用
ss -tlnp | grep -E "808[0-9]"

# 3. 查找孤儿 Python 进程（PPID=1 的 python 进程 = 父进程死后残留）
ps --ppid 1 -o pid,%cpu,etime,args | grep python

# 4. 查看后端日志
make dev-backend-logs
# 或：tail -f /tmp/backend.log

# 5. 强制清理端口
fuser -k 8081/tcp

# 6. 查看现有后端进程
ps aux | grep uvicorn | grep -v grep
```

## 健康端点

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 数据库 + Redis + CPU 时间 |
| `GET /api/debug/health` | 启动状态 + 可观测存储健康 |
| `GET /api/metrics` | Prometheus 指标 |

## 近期重要变更（进程安全）

| 防护 | 生效位置 |
|------|---------|
| 启动端口冲突检测 → 自动 kill 旧进程 | `scripts/dev/docker-entrypoint.sh` |
| 父进程死亡 → 子进程自尽 | `backend/src/core/app_lifespan.py` (prctl PR_SET_PDEATHSIG) |
| Agent 任务超时 → 默认 600s | `backend/src/tasks/agent_pipeline.py` (AGENT_TIMEOUT) |
| 超时后自动清理卡死子进程 | `backend/src/tasks/agent_pipeline.py` (_kill_stuck_child_processes) |
| Dev 启动脚本 → pidfile + `wait` 保活 | `scripts/dev/run-backend.sh` |
| health.py 监控脚本 | `scripts/dev/health.py` (健康检查 + 孤儿进程 + CPU load) |

## 已知问题

- **LangGraph multiprocessing 子进程卡死**: 某些库调用（LangGraph 等）会 spawn OS 子进程，
  `asyncio.timeout` 无法传播取消信号到子进程。超时后 `_kill_stuck_child_processes()` 会扫描并
  SIGKILL 残留的 multiprocessing 子进程。如果反复出现，说明库内部有死循环，需升级或隔离该库。|

## 任务超时配置

```bash
AGENT_TIMEOUT=300 make dev-backend   # 改 5 分钟
```
