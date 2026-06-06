---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：API 密钥管理

> 领域：基础设施
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

API 密钥的加密存储、验证、使用统计。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 添加密钥 | 01-create-key.md | ⬜ |
| 2 | 查询密钥列表 | 02-list-keys.md | ⬜ |
| 3 | 测试连接 | 03-test-key.md | ⬜ |
| 4 | 删除密钥 | 04-delete-key.md | ⬜ |
| 5 | 使用统计 | 05-usage-stats.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE user_api_keys (
    id UUID PRIMARY KEY,
    user_id VARCHAR(128),
    api_key_encrypted TEXT,
    api_key_masked VARCHAR(64),
    provider VARCHAR(64),
    base_url VARCHAR(256),
    is_valid BOOLEAN,
    last_validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 5 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
