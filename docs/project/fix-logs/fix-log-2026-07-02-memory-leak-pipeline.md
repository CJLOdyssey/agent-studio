# 修复日志：Pipeline 执行后内存泄漏（uvicorn 达 10GB）

## 问题信息

| 字段 | 内容 |
|------|------|
| 问题编号 | BUG-20260702-002 |
| 问题来源 | 开发自测 |
| 所属阶段 | 性能 |
| 问题级别 | 致命 |
| 发现日期 | 2026-07-02 |
| 发现人 | Sisyphus |

## 问题描述

uvicorn 进程 RSS 持续增长至 10GB（11GB 系统内存耗尽），多次测试后 swap 被打满。

## 影响范围

- 所有 API 请求
- 开发环境混合模式，每次 `POST /api/runs` 触发

## 根本原因

三重泄漏叠加：

### 1. SQLite 连接泄漏
`checkpoint.py` 每 run 创建 `AsyncSqliteSaver` 连接，从不关闭。10 次 run = 10 个 dangling aiosqlite 连接，每个带 checkpoint 内存。

**修复**：`.env` 设 `CHECKPOINTER_BACKEND=memory`。

### 2. 独立线程 + Event Loop 泄漏
`runs.py` 用 `threading.Thread(asyncio.run(pipeline))` 每 run 创建新线程 + 新 event loop。线程退出后栈/loop/对象不回收。

**修复**：改为 `asyncio.create_task()` 在主 event loop 跑。

### 3. LangGraph 循环引用不回收
`tasks.py` 创建 `SingleAgentGraph` + `StreamEmitter` + checkpointer，函数退出后 Python GC 不回收循环引用。

**修复**：`try/finally` + `del graph/checkpointer/emitter` + `gc.collect()`。

## 修复方案

| 文件 | 改动 |
|------|------|
| `.env` | 新增 `CHECKPOINTER_BACKEND=memory` |
| `routers/runs.py` | `threading.Thread` → `asyncio.create_task` |
| `tasks.py` | `try/finally` 清理 + `gc.collect()` |
| `app.py` | lifespan 内 60s 定时 `gc.collect()` |

## 验证方法

```bash
# 多次发送消息后监控内存
for i in 1 2 3 4 5; do
  curl -s -X POST /api/runs -d '{"requirement":"test"}' > /dev/null &
done
sleep 30
ps aux | grep uvicorn  # RSS 应 < 200MB
```

## 备注

2026-07-02 | 已修复，uvicorn 稳定在 120-170MB | Sisyphus
