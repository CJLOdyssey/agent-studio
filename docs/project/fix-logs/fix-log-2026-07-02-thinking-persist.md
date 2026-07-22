# 修复日志：思考内容未持久化到数据库

## 问题信息

| 字段 | 内容 |
|------|------|
| 问题编号 | BUG-20260702-004 |
| 问题来源 | 功能需求 |
| 所属阶段 | 编码 |
| 问题级别 | 中等 |
| 发现日期 | 2026-07-02 |
| 发现人 | 用户 |

## 问题描述

思考内容（thinking）只在 localStorage 中存储，刷新后通过 localStorage 恢复。但数据库 `chat_messages` 表中没有 persistent 的 thinking 字段，换设备或清缓存后思考内容丢失。

## 影响范围

- 所有对话历史中的思考内容
- `database.py`、`repository/core.py`、`streaming.py`、`routers/runs.py`

## 根本原因

`ChatMessage` 模型没有 `thinking` 列。`StreamEmitter._flush_buffers()` 调用 `save_message()` 时只传了 `content`，未传 `thinking`。前端只能从 WebSocket 的 `thinking_done` 事件获取 thinking 并缓存到 localStorage。

## 修复方案

| 文件 | 改动 |
|------|------|
| `virtual_team/database.py` | `ChatMessage` 加 `thinking: Mapped[str \| None]` 列 |
| `virtual_team/models.py` | `MessageItem` 加 `thinking: str \| None = None` |
| `virtual_team/repository/core.py` | `save_message()` 加 `thinking` 参数 |
| `virtual_team/streaming.py` | `_flush_buffers()` 和 `_emit()` 把 `thinking` 传给 `save_message` |
| `virtual_team/routers/runs.py` | `get_run_detail` 消息返回 `thinking` 字段 |
| `alembic/versions/b590d3515bc9_*.py` | 新迁移：加 `thinking` 列 + 删废弃 `nodes` 列 |

## 验证方法

```bash
# 直接调用 save_message 验证持久化
PYTHONPATH=. python3 -c "
import asyncio
from repository.core import save_message, get_messages
asyncio.run(save_message(run_id='...', role='Agent', content='test', thinking='test thinking'))
msgs = asyncio.run(get_messages('...'))
print(msgs[0].thinking)  # 应输出 'test thinking'
"

# API 返回检查
curl -s /api/runs/{id} | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['messages'][0].get('thinking'))"
```

## 备注

2026-07-02 | 已修复，验证通过 | Sisyphus
