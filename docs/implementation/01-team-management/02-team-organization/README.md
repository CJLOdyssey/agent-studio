---
version: v1.0.0
created: 2026-06-07
updated: 2026-06-07
---

# 子域：团队组织管理

> 领域：团队管理
> 状态：✅ 已完成

---

## 子域概述

团队的创建、成员管理、排序。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 创建团队 | 01-create-team.md | ✅ |
| 2 | 查询团队列表 | 02-list-teams.md | ✅ |
| 3 | 更新团队 | 03-update-team.md | ✅ |
| 4 | 删除团队 | 04-delete-team.md | ✅ |
| 5 | 添加成员 | 05-add-member.md | ✅ |
| 6 | 移除成员 | 06-remove-member.md | ✅ |
| 7 | 成员排序 | 07-reorder-members.md | ✅ |

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 7 |
| 已完成 | 7 |
| 进度 | 100% |

---

## 测试覆盖

| 类型 | 文件 |
|---|---|---|
| 单元测试 | `tests/unit/repository/test_teams.py` (29 tests, all CRUD + members) |
| 功能测试 | `tests/functional/teams/test_teams.py` (24 tests, all API endpoints) |
| 边界测试 | `tests/boundary/test_team_boundary.py` (14 tests, schema validation) |
| 集成测试 | `tests/integration/test_team_lifecycle.py` (6 tests, smoke path) |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-07 | Sisyphus | 初始版本 |
| v1.1.0 | 2026-06-07 | Sisyphus | 子域闭环：测试门禁、分层审计、集成验证、灰盒用例、代码评审、质量门禁、文档归档 |
