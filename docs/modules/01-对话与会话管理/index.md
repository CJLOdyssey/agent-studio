# 01 对话与会话管理

## 业务闭环

```
用户输入需求 → 创建/复用 Session → 发送 Run → Agent 轮转执行 → 流式输出 → 保存消息 → 更新状态 → 用户查看历史 → 继续对话
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `ConversationsList` · `MessagesPanel` · `ChatInputArea` · `HomeScreen` |
| **前端状态** | `chatStore` (currentRunId, currentSessionId, messages, status) |
| **前端 Hook** | `useConversation` (localStorage 会话元数据) · `useMessageComposer` |
| **后端路由** | `sessions.py` (CRUD + Memory) · `runs.py` (创建 + WebSocket 流式) |
| **数据库表** | `sessions` · `project_runs` · `messages` |
| **核心逻辑** | `tasks.py` (_run_agent_pipeline) · `team_graph.py` (LangGraph 执行) |
| **实时通信** | `websocket.ts` (WebSocket 连接管理) · `broker.py` (Redis pub/sub) |

## 数据流

```
用户输入 ──▶ POST /api/runs ──▶ Celery 异步任务
    │                              │
    │                              ▼
    │                        team_graph.py
    │                        (PM→程序员→测试员 轮转)
    │                              │
    │                              ▼
    │                        WebSocket 流式推送
    │                              │
    ▼                              ▼
前端接收消息 ◀── Redis pub/sub ◀── StreamEmitter
    │
    ▼
保存到 messages 表 + 更新 project_runs 状态
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/runs` | 创建新 Run（对话） |
| GET | `/api/runs` | 列出 Run 历史 |
| GET | `/api/runs/{id}` | 获取 Run 详情 |
| WS | `/ws/runs/{id}` | WebSocket 流式消息 |
| GET | `/api/sessions` | 列出会话 |
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions/{id}` | 会话详情 |
| PUT | `/api/sessions/{id}` | 重命名会话 |
| DELETE | `/api/sessions/{id}` | 删除会话 |

## 数据库表

```sql
-- 会话表
CREATE TABLE sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    title VARCHAR(256) DEFAULT '新对话',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 运行表
CREATE TABLE project_runs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    session_id VARCHAR(36) REFERENCES sessions(id),
    requirement TEXT NOT NULL,
    pm_document TEXT DEFAULT '',
    code TEXT DEFAULT '',
    review TEXT DEFAULT '',
    approved BOOLEAN DEFAULT FALSE,
    status VARCHAR(32) DEFAULT 'pending',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
    id VARCHAR(36) PRIMARY KEY,
    run_id VARCHAR(36) REFERENCES project_runs(id),
    role VARCHAR(64) NOT NULL,
    content TEXT NOT NULL,
    round_number INTEGER DEFAULT 1,
    created_at TIMESTAMP
);
```
