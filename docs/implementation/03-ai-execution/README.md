---
version: v1.0.0
created: 2026-06-06
updated: 2026-06-06
---

# 领域：AI 执行

> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 领域概述

Agent 的核心执行能力，包括引擎编排、工具调用、技能加载、MCP 集成。

---

## 子域清单

| # | 子域 | 文件 | 说明 | 状态 |
|---|---|---|---|---|
| 01 | [Agent 引擎](01-agent-engine/) | LangGraph 编排、状态机 | ⬜ |
| 02 | [工具管理](02-tool-management/) | 工具 CRUD、生成、导入 | ⬜ |
| 03 | [技能管理](03-skill-management/) | 技能 CRUD、生成、导入 | ⬜ |
| 04 | [MCP 管理](04-mcp-management/) | MCP CRUD、导入、连接 | ⬜ |

---

## 领域模型

```
AgentEngine (引擎)
├── Tool (工具)
│   ├── code (代码)
│   └── tool_def (元数据)
├── Skill (技能)
│   ├── content (YAML)
│   └── triggers (触发词)
└── MCP (外部服务)
    ├── transport (传输方式)
    └── capabilities (能力)
```

---

## 进度

| 指标 | 值 |
|---|---|
| 子域 | 4 |
| 已完成 | 0 |
| 进度 | 0% |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
