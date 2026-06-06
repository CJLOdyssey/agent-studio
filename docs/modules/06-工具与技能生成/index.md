# 06 工具与技能生成

## 业务闭环

```
描述需求 → LLM 生成工具/技能代码 → 验证 → 保存到 tools/skills 目录 → Agent 可调用
```

## 子模块

| 子模块 | 说明 |
|---|---|
| [tool-generation](tool-generation/) | 工具代码生成 (tools.py) |
| [skill-generation](skill-generation/) | 技能文档生成 (skills.py) |

## 层级实现

| 层级 | 实现 |
|---|---|
| **后端路由** | `tools.py` (工具 CRUD + 生成) · `skills.py` (技能 CRUD + 生成) |
| **提示词** | `shared/prompts/` (TOOL_GENERATION_PROMPT, SKILL_GENERATION_PROMPT) |
| **存储** | `tools/` 目录 (Python 代码) · `skills/` 目录 (YAML 文档) |
| **前端组件** | `DevAgentsSidebar` (工具/技能列表) |
| **前端 Hook** | `useTools` · `useSkills` |

## 数据流

```
用户描述需求
    │
    ▼
POST /api/tools/generate
    │
    ▼
LLM 生成工具代码
    │
    ▼
验证 (ast.parse + 语法检查)
    │
    ├── 通过 ──▶ 保存到 tools/{name}.py
    └── 失败 ──▶ 返回错误
    │
    ▼
Agent 可调用 (通过 tools 列表注入)
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tools` | 列出所有工具 |
| POST | `/api/tools/generate` | 生成工具 |
| PUT | `/api/tools/{name}` | 更新工具 |
| DELETE | `/api/tools/{name}` | 删除工具 |
| GET | `/api/skills` | 列出所有技能 |
| POST | `/api/skills/generate` | 生成技能 |
| PUT | `/api/skills/{name}` | 更新技能 |
| DELETE | `/api/skills/{name}` | 删除技能 |
