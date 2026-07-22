# 修复日志：SqliteSaver 同步检查点不兼容 LangGraph 异步操作

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | SqliteSaver 同步检查点不兼容 LangGraph 异步操作 |
| 修复编号 | FIX-20260630-002 |
| 关联缺陷 | — |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `backend/checkpoint.py`、`backend/agent_graph.py`、`backend/team_graph.py`、`requirements.txt` |
| 影响范围 | 所有使用 LangGraph 的对话/Agent 运行（Celery 任务、CLI） |
| 触发条件 | 发送聊天消息触发 Celery worker 执行 LangGraph pipeline |

---

## Part B — 根因分析

### 2.1 问题现象

Celery worker 执行 LangGraph pipeline 时报错 `SqliteSaver not support async`，Agent 运行失败，状态变为 `error`。

### 2.2 根本原因

**一句话概括**：`create_checkpointer()` 返回同步版本 `SqliteSaver`/`PostgresSaver`，但 `SingleAgentGraph.run()` 使用 `self._graph.astream_events()`（异步操作），同步检查点无法处理异步事件循环调度。

LangGraph 2.0+ 支持同步（`.invoke()`）和异步（`.ainvoke()`、`.astream_events()`）两种执行模式，但后端检查点必须与执行模式匹配：
- 同步执行 → `SqliteSaver` / `PostgresSaver`
- 异步执行 → `AsyncSqliteSaver` / `AsyncPostgresSaver`

### 2.3 数据流溯源

```
用户发送消息 → POST /api/runs
  → API handler 返回 {"status": "pending"}
  → Celery task run_agent.delay(...)
  → _run_async(_run_agent_pipeline(...))
  → SingleAgentGraph(model, api_key, ...)
    → create_checkpointer()  → SqliteSaver（同步）
    → workflow.compile(checkpointer=SqliteSaver)
  → await graph.run(...)
    → self._graph.astream_events(...)  # 异步
    → SqliteSaver.not_support_async → ❌ RuntimeError
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 旧版本 LangGraph 兼容 | 之前使用的 LangGraph 版本可能允许混用 |
| 本地测试路径不同 | 本地 CLI `main.py` 走的执行路径可能不同 |

---

## Part C — 修复方案

### 3.1 修复策略

将检查点实现从同步版（`SqliteSaver`/`PostgresSaver`）切换为异步版（`AsyncSqliteSaver`/`AsyncPostgresSaver`），并添加异步所需的依赖。

### 3.2 修改清单

| # | 文件 | 变更说明 |
|---|------|---------|
| 1 | `backend/checkpoint.py` | 使用 `AsyncSqliteSaver` 替代 `SqliteSaver`，`AsyncPostgresSaver` 替代 `PostgresSaver` |
| 2 | `requirements.txt` | 新增 `aiosqlite>=0.20.0`、`langgraph-checkpoint-sqlite>=3.0.0`、`langgraph-checkpoint-postgres>=3.1.0` |

### 3.3 关键代码 diff

```diff
  if backend == "postgres":
-     from langgraph.checkpoint.postgres import PostgresSaver
+     from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
      ...
-     return PostgresSaver.from_conn_string(dsn)
+     conn = await AsyncConnection.connect(dsn)
+     saver = AsyncPostgresSaver(conn)
+     await saver.setup()
+     return saver

  if backend == "sqlite":
-     from langgraph.checkpoint.sqlite import SqliteSaver
-     return SqliteSaver.from_conn_string(dsn)
+     import aiosqlite
+     from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
+     conn = await aiosqlite.connect(dsn)
+     return AsyncSqliteSaver(conn)
```

---

## Part D — 复盘总结

### 4.1 经验教训

LangGraph 的同步/异步 API 在编译时需要匹配检查点类型。`astream_events()` 必须使用 Async 系列检查点。后续添加新引擎（如 TeamGraph）时需确认执行模式。

### 4.2 改进措施

无。

### 4.3 关联问题

FIX-20260630-004（此修复引入的 `asyncio.run()` 嵌套问题）。
