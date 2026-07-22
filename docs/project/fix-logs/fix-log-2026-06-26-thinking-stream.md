# Fix: DeepSeek 思考过程流式展示修复

- **日期**: 2026-06-26
- **作者**: Sisyphus
- **涉及模块**: broker, runs router, streaming, Docker 构建

---

## 问题描述

用户提交请求后，前端"思考中"面板展开但无思考内容，仅在响应结束后在"已思考"面板一次性显示完整文本。DeepSeek 的 `reasoning_content` 未在思考阶段逐块送达前端。

## 根因分析

### 1. 容器镜像过时（表面原因）

Docker 容器 `agent-studio-worker` 中运行的 `streaming.py` 为旧版本，其 `StreamEmitter.__call__` 的 `on_custom_thinking` 分支仅追加到 `_thinking_buffer`，缺少对 `publish_run_message` 的调用，导致 `thinking_stream` 消息从未发布到 Redis。

### 2. 时序竞争（深层原因）

即使代码正确，以下调用顺序也会导致消息丢失：

```python
# 修复前（runs.py）
run_agent.delay(...)         # 1. 入队 Celery，worker 立即开始处理
await buffer_run_messages()  # 2. 建立 Redis 订阅（晚了）
```

Worker 处理 SSE 流极快，`reasoning_content` 通常在 200ms 内开始输出。若 Redis 订阅尚未就绪，前 N 条 `thinking_stream` 全部丢失。

此外 `buffer_run_messages` 内部使用 `asyncio.create_task(_worker())`，`_worker` 中 `await pubsub.subscribe()` 是惰性执行的，函数返回时订阅未必已建立。

### 3. 缺少属性初始化

`StreamEmitter.__init__` 使用 `self._pending_thinking` 但未初始化，在工具调用场景触发 `AttributeError`。

---

## 修复内容

| 文件 | 行 | 修改 |
|------|-----|------|
| `backend/streaming.py` | `__init__` | 补 `self._pending_thinking: str \| None = None` |
| `backend/broker.py` | `buffer_run_messages()` | 将 `pubsub.subscribe()` 提升到同步位置，await 确认订阅完成后再启动后台 worker |
| `backend/routers/runs.py` | `create_run()` | 交换 `buffer_run_messages(run_id)` 到 `run_agent.delay()` **之前** |
| `docker-compose.local.yml` | frontend env | `VITE_API_BASE_URL` 改为空字符串（利用 nginx 同源代理） |
| Docker 镜像 | backend + celery | `DOCKER_BUILDKIT=0 docker compose build --no-cache` 重建 |

### 核心修复（时序）

```python
# 修复后（runs.py）
await buffer_run_messages(run_id)  # 1. 先订阅（同步 await，确保就绪）
run_agent.delay(...)               # 2. 再入队
```

```python
# 修复后（broker.py）
async def buffer_run_messages(run_id: str) -> None:
    buf: list[dict] = []
    _buffers[run_id] = buf
    r = get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(f"run:{run_id}")  # ← 同步等待订阅建立

    async def _worker():
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                parsed = json.loads(msg["data"])
                buf.append(parsed)

    _buffer_tasks[run_id] = asyncio.create_task(_worker())
```

---

## 验证

### 验证指标

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| `thinking_stream` 到达 buffer | 0 条 | 445 条 |
| `thinking_done` 内容 | 74-861 chars | 2591 chars |
| 前端"思考中"内容 | 空白 | 逐块增长 |
| Worker 任务处理 | 无日志 | Celery 正常处理 |

### 验证日志

```
[00:17:45] Buffer received: type=thinking_stream content_len=4 thinking_len=0  ← ×445
[00:17:45] Buffer received: type=thinking_stream content_len=5 thinking_len=0
...
[00:18:06] Buffer received: type=thinking_done content_len=0 thinking_len=2591  ← 完整思考
```

### 截图

- `thinking-stream-before.png`: 修复前 buffer 日志（无 `thinking_stream`）
- `thinking-stream-after.png`: 修复后前端"已思考 52s"面板展开（2600 字思考内容可见）

---

## 涉及文件列表

```
backend/streaming.py          # +2 lines (pending_thinking init)
backend/broker.py             # +10/-10 lines (sync subscription)
backend/routers/runs.py       # +4/-6 lines (swap order)
docker-compose.local.yml           # +1/-1 line (VITE_API_BASE_URL)
```

## 附：排查流程

1. 确认 buffer 日志中 `thinking_stream` = 0 → 确定后端未推送
2. `docker exec` 检查容器代码 → 发现 `streaming.py` 缺少 `publish_run_message`
3. `docker build --no-cache` 重建镜像 → 代码正确但仍无 `thinking_stream`
4. 检查 Celery worker 日志 → 发现任务被同步 fallback 执行（worker 容器断开）
5. 定位 `runs.py` 时序顺序 → `delay()` 在 `buffer_run_messages()` 之前
6. 检查 `broker.py` → `subscribe()` 是惰性的，`create_task` 不等待就绪
7. 修复时序 + 重建镜像 + 重启容器 → 验证通过
