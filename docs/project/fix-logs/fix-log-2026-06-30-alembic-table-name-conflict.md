# 修复日志：Alembic 迁移表名 `checkpoints` 与 langgraph 内部表冲突

> 模板来源：`docs/sdlc/补充-fix-log-template.md`

---

## Part A — 基本信息

| 字段 | 内容 |
|------|------|
| 标题 | Alembic 迁移表名 `checkpoints` 与 langgraph 内部表冲突 |
| 修复编号 | FIX-20260630-003 |
| 关联缺陷 | — |
| 日期 | 2026-06-30 |
| 作者 | Sisyphus |
| 涉及模块 | `virtual_team/checkpoint.py`、`alembic/versions/d3e1f2a3b4c5_rename_checkpoints_to_agent_checkpoints.py` |
| 影响范围 | 数据库迁移、checkpoint 持久化 |
| 触发条件 | 使用 `AsyncPostgresSaver` 或 `AsyncSqliteSaver` 时，langgraph 内部创建同名 `checkpoints` 表 |

---

## Part B — 根因分析

### 2.1 问题现象

Alembic 迁移创建了 `checkpoints` 表，同时 `AsyncPostgresSaver.setup()` 内部也创建同名 `checkpoints` 表，导致表名冲突和应用端 checkpoint 数据无法存储。

### 2.2 根本原因

**一句话概括**：`CheckpointDB` ORM 模型使用 `__tablename__ = "checkpoints"`，与 langgraph 的 `AsyncSqliteSaver`/`AsyncPostgresSaver` 内部使用的 `checkpoints` 表名冲突。

项目自有的 checkpoint 存储（`CheckpointDB`）用于持久化 agent 状态快照（供前端恢复会话），而 langgraph 的 `AsyncSqliteSaver` 使用同名的 `checkpoints` 表存储 LangGraph 内部执行状态。两者互不兼容。

### 2.3 数据流溯源

```
AsyncPostgresSaver.setup()
  → CREATE TABLE IF NOT EXISTS checkpoints (...)  ← langgraph 内部表
  → 与 CheckpointDB 的 checkpoints 表同名

同时存在 CheckpointDB（项目自身）和 langgraph 内部 saver 时：
  → 两个系统操作同一张表 → 数据混乱
```

### 2.4 为什么之前没发现

| 原因 | 说明 |
|------|------|
| 之前用的不是 Async 系列 | 旧版 `SqliteSaver` 不使用 `checkpoints` 表名（或使用的表结构不同） |

---

## Part C — 修复方案

### 3.1 修复策略

将项目自定义的 `CheckpointDB.__tablename__` 从 `checkpoints` 改为 `agent_checkpoints`，并创建 Alembic 迁移进行表重命名。

### 3.2 修改清单

| # | 文件 | 变更说明 |
|---|------|---------|
| 1 | `virtual_team/checkpoint.py` | `CheckpointDB.__tablename__` 改为 `"agent_checkpoints"` |
| 2 | `alembic/versions/d3e1f2a3b4c5_rename_checkpoints_to_agent_checkpoints.py` | 新增迁移：RENAME TABLE checkpoints → agent_checkpoints |

---

## Part D — 复盘总结

### 4.1 经验教训

ORM 模型表名与第三方库（尤其是 langgraph 这类框架级库）的内部表名容易冲突。命名时应使用项目前缀（如 `agent_`）避免冲突。

### 4.2 改进措施

| # | 措施 | 责任人 |
|---|------|--------|
| 1 | 新建 ORM 模型时检查 langgraph 内部表名列表 | Sisyphus |

### 4.3 关联问题

FIX-20260630-002（引入 Async 系列检查点时暴露此问题）。
