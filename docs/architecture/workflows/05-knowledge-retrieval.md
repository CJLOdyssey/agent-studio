# 5. 知识检索

> 文件上传、文档处理、向量检索，为 Agent 提供外部知识。

---

## 架构树

```
5. 知识检索
├── 5.1 文件上传与管理
│   ├── 功能：上传 / 下载 / 按会话关联
│   ├── BE: routers/attachments.py
│   └── DB: attachments
│
├── 5.2 文档处理管道
│   ├── 功能：文本提取 / 分块 / 向量化 / 向量存储
│   └── BE: rag/rag_chunking.py, rag/rag_embedding.py, rag/rag_store.py
│
└── 5.3 检索问答
    ├── 功能：向量搜索 / 上下文注入 / 引用生成
    └── BE: rag/rag_pipeline.py
```

---

## 5.1 文件上传与管理

| 项目 | 内容 |
|------|------|
| **功能** | 文件上传（类型校验 + 大小限制） |
| | 文件下载 |
| | 按会话关联 |
| **后端** | `routers/attachments.py` |
| **ORM** | `AttachmentDB` → `attachments` |
| **状态** | ✅ |

## 5.2 文档处理管道

| 项目 | 内容 |
|------|------|
| **功能** | 文本提取（\_extract_text） |
| | 分块策略（固定大小 / Markdown 段落 / 句边界） |
| | 向量化（调用 Embedding API） |
| | 向量存储（pgvector） |
| **后端** | `rag/rag_chunking.py`, `rag/rag_embedding.py`, `rag/rag_store.py` |
| **状态** | ⚠️ 需验证端到端管道 |

## 5.3 检索问答

| 项目 | 内容 |
|------|------|
| **功能** | 向量相似度搜索 |
| | 上下文注入 LLM Prompt |
| | 带引用的回答生成 |
| **后端** | `rag/rag_pipeline.py` |
| **状态** | ⚠️ 需验证端到端 RAG |
