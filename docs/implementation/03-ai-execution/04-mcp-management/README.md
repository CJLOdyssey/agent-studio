---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：MCP 管理

> 领域：AI 执行
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

MCP (Model Context Protocol) 配置的定义、导入、CRUD 管理。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 创建 MCP | 01-create-mcp.md | ⬜ |
| 2 | 查询 MCP 列表 | 02-list-mcp.md | ⬜ |
| 3 | 更新 MCP | 03-update-mcp.md | ⬜ |
| 4 | 删除 MCP | 04-delete-mcp.md | ⬜ |
| 5 | 导入 MCP | 05-import-mcp.md | ⬜ |
| 6 | 测试连接 | 06-test-connection.md | ⬜ |

---

## 数据库表

```sql
CREATE TABLE mcp_configs (
    id UUID PRIMARY KEY,
    name VARCHAR(64) UNIQUE,
    description TEXT,
    transport_type VARCHAR(32),  -- stdio, sse, streamable_http
    command VARCHAR(256),
    args JSONB,
    env JSONB,
    url VARCHAR(512),
    headers JSONB,
    capabilities JSONB,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
);
```

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 6 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
