# 04 记忆与知识管理

## 业务闭环

```
对话结束 → 提取 Memory → 保存到 memory_entries → 下次对话注入上下文 → RAG 向量检索增强 → 效果提升
```

## 子模块

| 子模块 | 说明 |
|---|---|
| [extraction](extraction/) | 从 Agent 输出中提取记忆条目 |
| [rag](rag/) | pgvector 向量检索 + 上下文增强 |

## 层级实现

| 层级 | 实现 |
|---|---|
| **后端核心** | `rag.py` (向量检索 + 上下文注入) |
| **数据库表** | `memory_entries` (pgvector 扩展) |
| **API 路由** | `sessions.py` (GET /api/sessions/{id}/memory) |
| **前端组件** | `MemoryViewer` (Memory 展示) · `MemoryBadge` (Memory 标记) |
| **前端 Hook** | `useMemory` (记忆加载) |

## 数据流

```
对话结束
    │
    ▼
extractors.py 提取记忆
    ├── PM 文档 → content_type: "pm_document"
    ├── 代码 → content_type: "code"
    └── 审查意见 → content_type: "review"
    │
    ▼
保存到 memory_entries 表
    │
    ▼
下次对话时
    │
    ├── _build_session_context() → 加载历史消息
    └── _get_rag_context() → pgvector 相似度检索
    │
    ▼
注入 System Prompt → Agent 拥有项目记忆
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/sessions/{id}/memory` | 获取会话记忆 |
| DELETE | `/api/sessions/{id}/memory/{memory_id}` | 删除记忆条目 |
| DELETE | `/api/sessions/{id}/memory` | 清空会话记忆 |

## 数据库表

```sql
CREATE TABLE memory_entries (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES sessions(id) ON DELETE CASCADE,
    run_id VARCHAR(36) REFERENCES project_runs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(64) DEFAULT 'general',
    embedding vector(1536),
    created_at TIMESTAMP
);
```
