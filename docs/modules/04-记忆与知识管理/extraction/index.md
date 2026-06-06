# 04.1 Memory 提取

## 业务闭环

```
Agent 执行结束 → extractors.py 解析输出 → 按类型提取内容 → 生成向量嵌入 → 保存到 memory_entries
```

## 核心文件

`virtual_team/extractors.py`

## 提取器说明

| 提取器 | 函数 | 内容类型 | 提取逻辑 |
|---|---|---|---|
| PM 文档 | `extract_pm_document(text)` | `pm_document` | 匹配 `## 产品需求文档` 标记 |
| 代码 | `extract_code(text)` | `code` | 匹配 `## 前端代码` / `## 后端代码` 标记 |
| 审查意见 | `extract_review(text)` | `review` | 匹配 `## 审查意见` 标记 |

## 提取流程

```python
# tasks.py 中的执行流程
pm_doc = extract_pm_document(pm_output)      # 提取 PM 文档
code = extract_code(frontend_output)          # 提取前端代码
review = extract_review(tester_output)        # 提取审查意见

# 保存到 memory_entries
if pm_doc:
    await save_memory(session_id, run_id, pm_doc, "pm_document", db)
if code:
    await save_memory(session_id, run_id, code, "code", db)
if review:
    await save_memory(session_id, run_id, review, "review", db)
```
