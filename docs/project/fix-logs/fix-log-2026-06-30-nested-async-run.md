# 修复日志：Celery worker 中 `asyncio.run()` 嵌套导致 RuntimeError

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | Celery worker 中 `asyncio.run()` 嵌套导致 RuntimeError |
| 修复编号 | FIX-20260630-004 |
| 关联缺陷 | FIX-20260630-002（引入 async checkpointer 时暴露此问题） |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `virtual_team/checkpoint.py`、`virtual_team/agent_graph.py`、`virtual_team/team_graph.py`、`virtual_team/tasks.py`、`virtual_team/main.py` |
| 影响范围 | Celery worker 执行 LangGraph pipeline、CLI 运行 |
| 触发条件 | Celery worker 调用 `create_checkpointer()`（内有 `asyncio.run()`）时，已有运行中的事件循环 |

---

## Part B — 根因分析

### 2.1 问题现象

FIX-20260630-002 启用 `AsyncSqliteSaver` 后，Celery worker 在创建检查点时抛出 `RuntimeError: asyncio.run() cannot be called from a running event loop`，Agent 运行失败。

### 2.2 根本原因

**一句话概括**：`AsyncSqliteSaver`/`AsyncPostgresSaver` 需要 `await saver.setup()` 进行异步初始化，但 `create_checkpointer()` 是同步函数，内部使用 `asyncio.run()` 来运行异步初始化。Celery worker 的 `_run_async()` 已经通过 `asyncio.run(coro)` 创建了事件循环，嵌套调用 `asyncio.run()` 违反 Python 3.12+ 的限制。

调用链：
```
run_agent (Celery task, sync)
  → _run_async(_run_agent_pipeline(...))    # 创建事件循环 A
    → _run_agent_pipeline (async)
      → SingleAgentGraph(...)
        → create_checkpointer()             # 同步函数
          → asyncio.run(_init_async())      # ❌ 试图创建事件循环 B（失败）
```

### 2.3 数据流溯源

```
Celery worker 线程：
  asyncio.run(coro)       ← 创建事件循环 A
  └─ _run_agent_pipeline
     └─ SingleAgentGraph.__init__
        └─ create_checkpointer()
           └─ asyncio.run(_init_pg())  ← ❌ 事件循环 A 已存在，Python 禁止嵌套
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 旧版 `SqliteSaver` 不需要 async init | `SqliteSaver` 构造器是同步的，无需 `asyncio.run()` |
| 本地测试路径不同 | 部分测试直接调用 `create_checkpointer(backend='memory')`，不会触发 async 路径 |

---

## Part C — 修复方案

### 3.1 修复策略

将 `create_checkpointer()` 拆分为两个入口：
- **`create_checkpointer()`**（同步）：保留向后兼容，内部检测是否有运行中的事件循环。无循环时直接用 `asyncio.run()`，有循环时通过线程池创建新事件循环。
- **`create_checkpointer_async()`**（异步）：Coro 版本，可直接 `await`，供 Celery worker 等异步上下文使用。

同时让 `SingleAgentGraph` 和 `TeamGraph` 的构造器接受可选的 `checkpointer` 参数，由调用方（`tasks.py`、`main.py`）使用 `await create_checkpointer_async()` 创建后传入。

### 3.2 修改清单

| # | 文件 | 变更说明 |
|---|------|---------|
| 1 | `virtual_team/checkpoint.py` | 新增 `async create_checkpointer_async()` 和 `_create_checkpointer_async()`；重构 `create_checkpointer()` 为同步包装器 |
| 2 | `virtual_team/agent_graph.py` | `SingleAgentGraph.__init__` 新增 `checkpointer` 参数；导入 `BaseCheckpointSaver` |
| 3 | `virtual_team/team_graph.py` | `TeamGraph.__init__` 新增 `checkpointer` 参数 |
| 4 | `virtual_team/tasks.py` | `_run_agent_pipeline` 中改用 `await create_checkpointer_async()` 并传入 `graph` |
| 5 | `virtual_team/main.py` | `_run_cli_async` 中改用 `await create_checkpointer_async()` 并传入 `graph` |

### 3.3 关键代码 diff

```diff
# checkpoint.py
+ async def create_checkpointer_async(...) -> BaseCheckpointSaver:
+     backend, dsn = _resolve_backend(backend, dsn)
+     return await _create_checkpointer_async(backend, dsn)

  def create_checkpointer(...) -> BaseCheckpointSaver:
      backend, dsn = _resolve_backend(backend, dsn)
-     return asyncio.run(_init_pg())
+     # 安全处理：检测运行中的事件循环
+     try:
+         asyncio.get_running_loop()
+     except RuntimeError:
+         return asyncio.run(_create_checkpointer_async(backend, dsn))
+     # 已有循环 → 线程池
+     with ThreadPoolExecutor(max_workers=1) as pool:
+         return pool.submit(asyncio.run, _create_checkpointer_async(backend, dsn)).result()

# tasks.py
- graph = SingleAgentGraph(model=..., api_key=...)
+ checkpointer = await create_checkpointer_async()
+ graph = SingleAgentGraph(model=..., api_key=..., checkpointer=checkpointer)
```

---

## Part D — 复盘总结

### 4.1 经验教训

Python 3.12+ 禁止嵌套调用 `asyncio.run()`。在异步框架（Celery、FastAPI）中，如果需要从同步函数启动异步初始化，必须检测运行中的事件循环状态，不可直接使用 `asyncio.run()`。

### 4.2 改进措施

| # | 措施 | 责任人 |
|---|------|--------|
| 1 | 新加异步初始化逻辑时，优先提供 `async def` 版本函数 | Sisyphus |
| 2 | 避免在同步函数中调用 `asyncio.run()`，除非明确知道无运行中事件循环 | Sisyphus |

### 4.3 关联问题

FIX-20260630-002（此修复的前提）。
