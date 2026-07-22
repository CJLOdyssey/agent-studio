# 修复日志：CI checkpoint 测试与 AsyncSqliteSaver 不兼容

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | CI checkpoint 测试与 AsyncSqliteSaver 不兼容 |
| 修复编号 | FIX-20260630-006 |
| 关联缺陷 | FIX-20260630-002（引入 AsyncSqliteSaver 后测试未同步更新） |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `tests/checkpoint/test_checkpoint_persistence.py` |
| 影响范围 | CI `backend-quality` job 中的 pytest 阶段 |
| 触发条件 | CI 运行 pytest，3 个 checkpoint 测试全部失败 |

---

## Part B — 根因分析

### 2.1 问题现象

CI 中 `backend-quality` job 的 pytest 阶段报告 3 个测试失败：

| 测试 | 错误 |
|------|------|
| `test_sqlite_persistence_cross_process` | `RuntimeError: Event loop is closed` |
| `test_recovery_after_restart` | `subprocess.TimeoutExpired` |
| `test_checkpointer_rollback_on_error` | `RuntimeError: Event loop is closed` |

### 2.2 根本原因

**一句话概括**：测试使用同步方法（`.put()` / `.get()`）操作异步 `AsyncSqliteSaver` 实例，但该实例的连接关联的事件循环已被关闭。

`AsyncSqliteSaver` 的 `.put()` 方法内部调用 `asyncio.run_coroutine_threadsafe(coro, self._loop)`，其中 `self._loop` 指向创建连接时的线程事件循环。当测试 fixture 使用 `create_checkpointer()`（通过 ThreadPoolExecutor 创建连接）时，连接在另一个线程的事件循环中创建，该循环在线程池关闭后被回收，导致 `.put()` 调用时 `_loop` 已关闭。

`test_recovery_after_restart` 的子进程同样使用 `create_checkpointer()` 和同步 `.put()`，在子进程中被 `os._exit(0)` 截断，事件循环未正常关闭导致超时。

### 2.3 数据流溯源

```
pytest fixture: checkpointer_sqlite
  → create_checkpointer()
    → ThreadPoolExecutor.submit(asyncio.run, _create_checkpointer_async)
      → AsyncSqliteSaver(conn)  # conn 关联线程池的事件循环
    → 线程池关闭 → 事件循环关闭
  → yield cp  # 返回 AsyncSqliteSaver，但 _loop 已关闭

test:
  → cp.put(config, checkpoint, metadata, {})
    → run_coroutine_threadsafe(coro, self._loop)
    → self._loop is closed → ❌ RuntimeError
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 旧版用 `SqliteSaver` | 旧版同步 `SqliteSaver.put()` 不涉及事件循环，直接写入 SQLite |

---

## Part C — 修复方案

### 3.1 修复策略

将 3 个失败的测试改为 async fixture + async test：
- 使用 `create_checkpointer_async()` 替代 `create_checkpointer()`
- 使用 `.aput()` / `.aget()` 替代 `.put()` / `.get()`
- `test_recovery_after_restart` 的子进程脚本使用 `asyncio.run(main())` + `sys.exit(0)` 替代 `os._exit(0)`
- 同时修复子进程与主进程使用不同 DSN 的问题

### 3.2 修改清单

| # | 文件 | 变更说明 |
|---|------|---------|
| 1 | `tests/checkpoint/test_checkpoint_persistence.py` | fixture 改为 async；测试函数标记 `@pytest.mark.asyncio`；使用 async API；修复 subprocess DSN 不匹配 |

### 3.3 关键代码 diff

```diff
- @pytest.fixture
+ @pytest.fixture
+ async def checkpointer_sqlite(checkpoint_db_path):
+     from backend.checkpoint import create_checkpointer_async
+     cp = await create_checkpointer_async()
+     yield cp
+     conn = getattr(cp, "conn", None)
+     if conn is not None:
+         await conn.close()

- def test_sqlite_persistence_cross_process(checkpointer_sqlite, ...):
+ @pytest.mark.asyncio
+ async def test_sqlite_persistence_cross_process(checkpointer_sqlite, ...):
-     checkpointer_sqlite.put(config, checkpoint, metadata, {})
+     await checkpointer_sqlite.aput(config, checkpoint, metadata, {})
-     result = checkpointer_sqlite_fresh.get(config)
+     result = await checkpointer_sqlite_fresh.aget(config)

- cp.conn.close()
- os._exit(0)
+ await conn.close()
+ sys.exit(0)
```

---

## Part D — 复盘总结

### 4.1 经验教训

Async 系列 checkpointers 要求使用 async 上下文。测试代码中混用 sync/async 模式会导致事件循环生命周期问题。测试应始终与被测代码的执行模式一致。

### 4.2 改进措施

| # | 措施 | 责任人 |
|---|------|--------|
| 1 | 引入 async checkpointer 时同步更新所有依赖该 fixture 的测试 | Sisyphus |

### 4.3 关联问题

FIX-20260630-002（引入 Async 系列时暴露的测试兼容性问题）。
