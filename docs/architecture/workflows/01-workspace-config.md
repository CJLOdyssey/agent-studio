# 1. 工作区配置

> 用户在此管理 Agent、团队、工具、MCP、Skill、提示词、输出约束、工作流。

---

## 架构树

```
1. 工作区配置
├── 1.1 团队管理
│   ├── 功能：团队 CRUD / 成员管理 / 团队分类
│   ├── FE: TeamTree, TeamManagement, TeamFormModal, TeamMemberManager
│   ├── BE: routers/teams.py → repository/teams.py
│   └── DB: teams, team_agents
│
├── 1.2 Agent 配置
│   ├── 功能：Agent CRUD / 启用禁用 / 关联 Tool/MCP/Skill/Prompt / 测试 / 版本快照
│   ├── FE: AgentManagement, AgentFormModal, ResourcePickerSection
│   ├── BE: routers/agents.py → repository/agents.py
│   └── DB: agent_configs, versions
│
├── 1.3 工具管理
│   ├── 功能：Tool CRUD / 分类 / 语法校验 / 执行测试 / 连接测试
│   ├── FE: ToolManagement, ToolFormModal
│   ├── BE: routers/tools.py → repository/tools.py
│   └── DB: registered_tools
│
├── 1.4 MCP 管理
│   ├── 功能：MCP CRUD / 类型 / 连接测试
│   ├── FE: MCPManagement, MCPFormModal
│   ├── BE: routers/mcps.py → repository/mcps.py
│   └── DB: mcp_servers
│
├── 1.5 Skill 管理
│   ├── 功能：Skill CRUD / 分类
│   ├── FE: SkillManagement, SkillFormModal
│   ├── BE: routers/skills.py → repository/skills.py
│   └── DB: registered_skills
│
├── 1.6 提示词管理
│   ├── 功能：Prompt CRUD / 按分类过滤 / 版本快照 / 分类 / AI 生成 / 语法校验
│   ├── FE: PromptManagement, PromptFormModal
│   ├── BE: routers/prompts.py → repository/prompts.py
│   └── DB: prompts, versions
│
├── 1.7 输出约束管理
│   ├── 功能：CRUD（复用 Prompt 表） / 分类
│   ├── FE: OutputConstraintManagement, OutputFormModal
│   ├── BE: 复用 routers/prompts.py → repository/prompts.py
│   └── DB: prompts（按 category 过滤）
│
└── 1.8 工作流管理
    ├── 功能：工作流 CRUD / 按团队查询 / 可视化编辑器 / DAG 定义
    ├── FE: WorkflowManagement, WorkflowEditor
    ├── BE: routers/workflows.py → repository/workflows.py
    └── DB: workflow_configs, workflow_nodes, workflow_edges
```

---

## 1.1 团队管理

| 项目 | 内容 |
|------|------|
| **功能** | 团队 CRUD（列表/创建/编辑/删除） |
| | 成员管理（添加/移除/排序/关联Agent） |
| | 团队分类（硬编码：dev/ops/test ← ❌需后端接口） |
| **前端** | TeamTree, TeamManagement, TeamFormModal, TeamMemberManager |
| **后端** | `routers/teams.py` → `repository/teams.py` |
| **ORM** | `TeamDB` → `teams`, `TeamAgentDB` → `team_agents` |
| **状态** | ✅ CRUD 完整 |

## 1.2 Agent 配置

| 项目 | 内容 |
|------|------|
| **功能** | Agent CRUD（列表/创建/编辑/删除） |
| | 启用/禁用切换 |
| | 关联 Tool / MCP / Skill / Prompt |
| | 测试 Agent 对话 |
| | 版本快照（编辑时自动创建） |
| **前端** | AgentManagement, AgentFormModal, ResourcePickerSection |
| **后端** | `routers/agents.py` → `repository/agents.py` |
| **ORM** | `AgentConfigDB` → `agent_configs`, `versions` |
| **状态** | ✅ CRUD 完整 |

## 1.3 工具管理

| 项目 | 内容 |
|------|------|
| **功能** | Tool CRUD（列表/创建/编辑/删除） |
| | 分类列表（硬编码 ← ❌需后端接口） |
| | 语法校验 `POST /tools/validate` |
| | 执行测试 `POST /tools/execute` |
| | 连接测试 `POST /tools/{id}/test` |
| **前端** | ToolManagement, ToolFormModal |
| **后端** | `routers/tools.py` → `repository/tools.py` |
| **ORM** | `RegisteredToolDB` → `registered_tools` |
| **状态** | ✅ CRUD 完整，❌ 分类接口缺失 |

## 1.4 MCP 管理

| 项目 | 内容 |
|------|------|
| **功能** | MCP CRUD（列表/创建/编辑/删除） |
| | 类型列表（stdio/sse 硬编码 ← ❌需后端接口） |
| | 连接测试 `POST /mcps/{id}/test` |
| **前端** | MCPManagement, MCPFormModal |
| **后端** | `routers/mcps.py` → `repository/mcps.py` |
| **ORM** | `MCPServerDB` → `mcp_servers` |
| **状态** | ✅ CRUD 完整，❌ 类型接口缺失 |

## 1.5 Skill 管理

| 项目 | 内容 |
|------|------|
| **功能** | Skill CRUD（列表/创建/编辑/删除） |
| | 分类列表（硬编码 ← ❌需后端接口） |
| **前端** | SkillManagement, SkillFormModal |
| **后端** | `routers/skills.py` → `repository/skills.py` |
| **ORM** | `RegisteredSkillDB` → `registered_skills` |
| **状态** | ✅ CRUD 完整，❌ 分类接口缺失 |

## 1.6 提示词管理

| 项目 | 内容 |
|------|------|
| **功能** | Prompt CRUD（列表/创建/编辑/删除） |
| | 按分类过滤（系统提示词/用户提示词/任务模板/角色定义） |
| | 版本快照（编辑时自动创建） |
| | 分类列表（硬编码 ← ❌需后端接口） |
| | AI 生成提示词 `POST /prompts/generate` ❌ 未实现 |
| | 语法校验 `POST /prompts/validate` ❌ 未实现 |
| **前端** | PromptManagement, PromptFormModal, validate.ts |
| **后端** | `routers/prompts.py` → `repository/prompts.py` |
| **ORM** | `PromptDB` → `prompts`, `versions` |
| **状态** | ✅ CRUD 完整，❌ 生成+校验未实现 |

## 1.7 输出约束管理

| 项目 | 内容 |
|------|------|
| **功能** | CRUD（复用 Prompt 表 `category='output_constraint'`） |
| | 分类列表（硬编码 ← ❌需后端接口） |
| **前端** | OutputConstraintManagement, OutputFormModal |
| **后端** | 复用 `routers/prompts.py` → `repository/prompts.py` |
| **ORM** | `prompts`（按 category 过滤） |
| **状态** | ✅ CRUD 完整 |

## 1.8 工作流管理

| 项目 | 内容 |
|------|------|
| **功能** | 工作流 CRUD（列表/按团队查询/保存/删除） |
| | 可视化编辑器（节点+边） |
| | DAG 定义（nodes: agent+strategy+order, edges: condition+priority） |
| **前端** | WorkflowManagement, WorkflowEditor |
| **后端** | `routers/workflows.py` → `repository/workflows.py` |
| **ORM** | `WorkflowConfigDB` → `workflow_configs`, `workflow_nodes`, `workflow_edges` |
| **状态** | ✅ CRUD 完整 |
