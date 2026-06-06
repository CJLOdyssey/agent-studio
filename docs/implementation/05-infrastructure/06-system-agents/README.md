---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 子域：工具生成 Agent

> 领域：系统团队管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 子域概述

系统级工具生成 Agent，根据用户描述自动生成 Python 工具代码。

---

## 功能清单 (TDD)

| # | 功能 | 文件 | 状态 |
|---|---|---|---|
| 1 | 加载 Agent 配置 | 01-load-config.md | ⬜ |
| 2 | 生成工具代码 | 02-generate-tool.md | ⬜ |
| 3 | 验证代码语法 | 03-validate-code.md | ⬜ |
| 4 | 保存到 tools/ 目录 | 04-save-tool.md | ⬜ |

---

## Agent 配置

```yaml
# system_team/agents/tools_agent.yaml
name: tools_agent
description: 工具生成专家
system_prompt: |
  你是一个专业的工具生成专家...
tools:
  - code_execution
  - file_operations
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
