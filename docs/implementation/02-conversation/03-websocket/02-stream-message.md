---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：流式消息推送

> 子域：实时通信
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为前端，我希望实时接收 Agent 产生的消息。

---

## 验收标准

- [ ] 接收 role、content、round_number
- [ ] 消息实时更新到 UI
- [ ] 支持多 Agent 并发

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_websocket.py`

```python
async def test_stream_message():
    async with client.websocket_connect("/ws/runs/test-run-id") as ws:
        # 模拟发送消息
        await publish_message(run_id, "pm", "测试内容", 1)
        data = await ws.receive_json()
        assert data["role"] == "pm"
        assert data["content"] == "测试内容"
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/streaming.py`

```python
class StreamEmitter:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def emit(self, run_id: str, role: str, content: str, round_number: int):
        message = {
            "type": "message",
            "role": role,
            "content": content,
            "round_number": round_number
        }
        await self.redis.publish(f"run:{run_id}", json.dumps(message))
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_websocket.py` |
| 后端 | `virtual_team/streaming.py` |
| 前端 | `frontend/src/websocket.ts` |

---

## 进度

| 步骤 | 状态 |
|---|---|
| 编写测试 | ⬜ |
| 测试失败 (RED) | ⬜ |
| 编写实现 | ⬜ |
| 测试通过 (GREEN) | ⬜ |
| 重构 (REFACTOR) | ⬜ |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
