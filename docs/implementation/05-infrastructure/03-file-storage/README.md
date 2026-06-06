---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：文件存储

> 领域：基础设施
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

文件的上传、下载、存储管理，支持多种格式。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 上传文件 | 01-upload-file.md | ⬜ |
| 2 | 下载文件 | 02-download-file.md | ⬜ |
| 3 | 删除文件 | 03-delete-file.md | ⬜ |
| 4 | 查询附件列表 | 04-list-attachments.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY,
    user_id VARCHAR(128),
    run_id UUID REFERENCES project_runs(id),
    filename VARCHAR(256),
    filepath VARCHAR(512),
    content_type VARCHAR(128),
    file_size BIGINT,
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 4 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
