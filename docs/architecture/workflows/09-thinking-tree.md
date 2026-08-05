# 9. 思维树（Thinking Tree）

> 思维树工具注册和执行引擎，用于增强 Agent 的思考过程。

---

## 架构树

```
9. 思维树
└── 功能：Thinking Tool 注册表 / Tavily 搜索工具
    └── BE: thinking_tree/registry.py, thinking_tree/tools/
```

---

## 9.1 Thinking Tool 注册表

| 项目 | 内容 |
|------|------|
| **功能** | Thinking Tool 注册与管理 |
| **后端** | `thinking_tree/registry.py` |
| **状态** | ⚠️ 需验证 |

## 9.2 搜索工具

| 项目 | 内容 |
|------|------|
| **功能** | Tavily 搜索集成 |
| **后端** | `thinking_tree/tools/tavily_search.py` |
| **状态** | ⚠️ 需验证 |
