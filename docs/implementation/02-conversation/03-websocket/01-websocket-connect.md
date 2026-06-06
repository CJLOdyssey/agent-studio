---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：WebSocket 连接

> 子域：实时通信
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为前端，我希望建立 WebSocket 连接接收实时消息。

---

## 验收标准

- [ ] 成功连接 WebSocket
- [ ] 接收连接确认
- [ ] 支持断线重连

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_websocket.py`

```python
async def test_websocket_connect():
    async with client.websocket_connect("/ws/runs/test-run-id") as ws:
        data = await ws.receive_json()
        assert data["type"] == "connected"
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `virtual_team/routers/runs.py`

```python
@router.websocket("/ws/runs/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "run_id": run_id})
    # 保持连接并转发消息
    while True:
        data = await websocket.receive_text()
        # 处理消息
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_websocket.py` |
| API | `virtual_team/routers/runs.py` |
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
