# 3. 会话持久化

> 对话结束后，消息与会话数据持久化存储，支持刷新恢复和记忆管理。

---

## 架构树

```
3. 会话持久化
├── 3.1 会话管理
│   ├── 功能：会话 CRUD / 关联 runs / 关联 messages / sessionId 映射
│   ├── FE: useConversation
│   ├── BE: routers/sessions.py → repository/session_repo.py
│   └── DB: sessions, project_runs, chat_messages
│
├── 3.2 消息存储
│   ├── 功能：实时流式写入 / 内容+思考+版本
│   ├── BE: RunService → repository/message_repo.py
│   └── DB: chat_messages
│
├── 3.3 记忆管理
│   ├── 功能：记忆列表 / 删除 / 导出 JSON/MD
│   ├── BE: routers/sessions.py → repository/memory_repo.py
│   └── DB: memory_entries
│
└── 3.4 对话记录本地持久化
    ├── 功能：localStorage 即时写入 / 刷新恢复 / WS 断开同步
    └── FE: useConversation + useWorkstationState
```

---

## 3.1 会话管理

| 项目 | 内容 |
|------|------|
| **功能** | 会话 CRUD（列表/创建/详情/重命名/删除） |
| | 关联运行记录（runs） |
| | 关联消息（chat_messages） |
| | 前后端 sessionId 映射 |
| **前端** | useConversation（hook + localStorage） |
| **后端** | `routers/sessions.py` → `repository/session_repo.py` |
| **ORM** | `SessionDB` → `sessions`, `project_runs`, `chat_messages` |
| **状态** | ✅ |

## 3.2 消息存储

| 项目 | 内容 |
|------|------|
| **功能** | 实时流式写入（WebSocket 事件 → chat_messages） |
| | 消息内容+思考过程+版本信息 |
| **后端** | 复用 RunService → `repository/message_repo.py` |
| **ORM** | `ChatMessage` → `chat_messages` |
| **状态** | ✅ |

## 3.3 记忆管理

| 项目 | 内容 |
|------|------|
| **功能** | 记忆列表（按会话查看） |
| | 删除单条记忆 |
| | 导出（JSON/Markdown） |
| **后端** | `routers/sessions.py` → `repository/memory_repo.py` |
| **ORM** | `MemoryEntry` → `memory_entries` |
| **状态** | ✅ |

## 3.4 对话记录本地持久化

| 项目 | 内容 |
|------|------|
| **功能** | localStorage 即时写入（已修复） |
| | 刷新后恢复对话列表+消息（已修复） |
| | WebSocket 断开时同步（已修复） |
| **前端** | useConversation + useWorkstationState |
| **后端** | 无（纯前端持久化） |
| **状态** | ✅ 已修复 |
