---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：Agent 配置管理

> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

Agent 的全生命周期配置管理，包括基础信息、提示词、输出格式、工具、MCP、技能。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 测试 | 实现 | 状态 |
|---|---|---|---|---|---|
| 1 | 创建 Agent | [01-create-agent.md](01-create-agent.md) | test_agent.py | agent.py | ⬜ |
| 2 | 查询 Agent 列表 | [02-list-agents.md](02-list-agents.md) | test_agent.py | agent.py | ⬜ |
| 3 | 查询 Agent 详情 | [03-get-agent.md](03-get-agent.md) | test_agent.py | agent.py | ⬜ |
| 4 | 更新 Agent | [04-update-agent.md](04-update-agent.md) | test_agent.py | agent.py | ⬜ |
| 5 | 删除 Agent | [05-delete-agent.md](05-delete-agent.md) | test_agent.py | agent.py | ⬜ |
| 6 | 管理提示词版本 | [06-manage-prompts.md](06-manage-prompts.md) | test_prompt.py | prompt.py | ⬜ |
| 7 | 管理输出格式 | [07-manage-output-schema.md](07-manage-output-schema.md) | test_schema.py | schema.py | ⬜ |
| 8 | 绑定工具 | [08-bind-tools.md](08-bind-tools.md) | test_binding.py | binding.py | ⬜ |
| 9 | 绑定 MCP | [09-bind-mcp.md](09-bind-mcp.md) | test_binding.py | binding.py | ⬜ |
| 10 | 绑定技能 | [10-bind-skills.md](10-bind-skills.md) | test_binding.py | binding.py | ⬜ |

---

## TDD 流程

每个功能遵循：

```
1. 编写测试 → test_xxx.py
2. 运行测试 → 失败 (RED)
3. 编写实现 → repository.py + router.py
4. 运行测试 → 通过 (GREEN)
5. 重构优化 → 保持测试通过 (REFACTOR)
```

---

## 数据库表

```sql
-- Agent 主表
CREATE TABLE agents (...);

-- 绑定表
CREATE TABLE agent_tool_bindings (...);
CREATE TABLE agent_mcp_bindings (...);
CREATE TABLE agent_skill_bindings (...);
```

详见：[agent-config-schema.md](../../architecture/agent-config-schema.md)

---

## 进度

| 指标 | 值 |
|---|---|
| 功能 | 10 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
