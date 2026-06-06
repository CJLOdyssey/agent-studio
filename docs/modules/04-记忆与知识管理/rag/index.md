# 04.2 RAG 向量检索

## 业务闭环

```
用户输入 → 向量化查询 → pgvector 相似度检索 → 返回 Top-K 结果 → 注入 System Prompt → Agent 上下文增强
```

## 核心文件

`virtual_team/rag.py`

## 检索流程

```python
# rag.py 中的实现
async def get_rag_context(session_id: str, query: str, db) -> str:
    # 1. 向量化用户输入
    embedding = await get_embedding(query)
    
    # 2. pgvector 相似度检索 (cosine distance)
    results = await db.execute(
        select(memory_entries)
        .where(memory_entries.c.session_id == session_id)
        .order_by(memory_entries.c.embedding.cosine_distance(embedding))
        .limit(5)  # Top-5
    )
    
    # 3. 格式化为上下文
    context = format_memory_context(results)
    
    return context
```

## 向量存储

- **模型**: OpenAI text-embedding-3-small (1536 维)
- **扩展**: PostgreSQL pgvector
- **索引**: HNSW (Hierarchical Navigable Small World)
- **距离**: 余弦相似度 (cosine_distance)
