---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：连接保活

> 子域：实时通信
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为系统，我希望 WebSocket 连接保持活跃。

---

## 验收标准

- [ ] 定期发送心跳
- [ ] 检测连接状态
- [ ] 超时自动断开

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_websocket.py`

```python
async def test_heartbeat():
    async with client.websocket_connect("/ws/runs/test-run-id") as ws:
        # 等待心跳
        data = await ws.receive_json()
        assert data["type"] == "heartbeat"
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/routers/runs.py`

```python
@router.websocket("/ws/runs/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await websocket.accept()
    try:
        while True:
            # 发送心跳
            await websocket.send_json({"type": "heartbeat"})
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_websocket.py` |
| API | `virtual_team/routers/runs.py` |

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
