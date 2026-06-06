# 03.2 WebSocket 流式输出

## 业务闭环

```
Celery 任务执行 → StreamEmitter 发布消息 → Redis pub/sub → WebSocket 推送 → 前端实时渲染
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端** | `websocket.ts` (连接管理 + 重连) · `chatStore` (消息状态) |
| **后端** | `streaming.py` (StreamEmitter) · `broker.py` (Redis pub/sub) |
| **路由** | `runs.py` 中的 WebSocket 端点 |

## 数据流

```
Celery 任务 (tasks.py)
    │
    ▼
StreamEmitter.emit(role, content, round)
    │
    ▼
Redis PUBLISH run:{run_id} (JSON 消息)
    │
    ▼
WebSocket 端点 (runs.py) 订阅 Redis
    │
    ▼
推送到前端 WebSocket
    │
    ▼
前端 chatStore.addMessage() → MessagesPanel 实时渲染
```

## WebSocket 连接管理

```typescript
// 前端 websocket.ts
export function connectRun(runId: string, options: ConnectOptions): ConnState {
    const ws = new WebSocket(`ws://${host}/ws/runs/${runId}`);
    // 自动重连（最多 3 次）
    // 心跳检测
    // 消息解析 + 回调
}
```

## 消息格式

```json
{
    "type": "message",
    "role": "pm",
    "content": "## 产品需求文档\n...",
    "round_number": 1,
    "timestamp": "2026-06-06T10:00:00Z"
}
```
