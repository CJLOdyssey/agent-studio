# 🗺️ 项目导航 — CLAUDE.md

> **本文件是 AI Agent 的核心导航入口。** 新增模块时必须同步更新此文件。

---

## 📋 快速定位表

| 功能 | 中文名 | 前端路径 | 后端路由 | 后端 repository | DB 表 |
|------|--------|----------|----------|-----------------|-------|
| Agent管理 | Agent管理 | `workstation/agent/` | `routers/agents.py` | `repository/agents.py` | `agent_configs` |
| 提示词管理 | 提示词管理 | `workstation/prompt/` | `routers/prompts.py` | `repository/prompts.py` | `prompts` |
| 输出约束 | 输出约束 | `workstation/output/` | — (嵌入 AgentConfig) | — | `agent_configs.output_constraints` |
| 工具管理 | 工具管理 | `workstation/tool/` | `routers/tools.py` | `repository/tools.py` | `registered_tools` |
| MCP管理 | MCP管理 | `workstation/mcp/` | `routers/mcps.py` | `repository/mcps.py` | `mcp_servers` |
| Skills管理 | Skills管理 | `workstation/skill/` | `routers/skills.py` | `repository/skills.py` | `registered_skills` |
| 团队管理 | 团队管理 | `workstation/team/` | `routers/teams.py` | `repository/teams.py` | `teams` |
| 监控中心 | 监控中心 | `workstation/monitor/` | — (纯前端) | — | — |
| 日志审计 | 日志审计 | `workstation/logs/` | — (纯前端) | — | `command_logs` (后端审计) |
| 工作流引擎 | 工作流 | `workstation/workflow/` | `routers/workflows.py` | `repository/workflows.py` | `workflow_configs` / `workflow_nodes` / `workflow_edges` |
| 密钥管理 | 系统设置 | — | `routers/keys.py` | `repository/keys.py` | `user_api_keys` |
| 用户管理 | 用户管理 | — | — | — | `users` / `roles` / `user_roles` |
| Checkpoint | Checkpoint | — | — | — | `checkpoints` |

---

## 🏗️ 项目结构概览

```
项目 7：AgentStudio/
├── CLAUDE.md                    ← 你在这里
├── frontend/                    # React + Vite + TanStack Query + Zustand
│   └── src/
│       ├── components/agentstudio/
│       │   ├── AgentStudioWorkstation.tsx   # 🎯 主入口（聊天+侧栏+工作台）
│       │   ├── WorkstationPage.tsx          # 工作台菜单入口（10 Tab）
│       │   ├── workstation/                 # 工作台 10 模块
│       │   │   ├── agent/                  #  1. Agent 管理
│       │   │   ├── prompt/                 #  2. 提示词管理
│       │   │   ├── output/                 #  3. 输出约束
│       │   │   ├── tool/                   #  4. 工具管理
│       │   │   ├── mcp/                    #  5. MCP 管理
│       │   │   ├── skill/                  #  6. Skills 管理
│       │   │   ├── team/                   #  7. 团队管理
│       │   │   ├── monitor/                #  8. 监控中心
│       │   │   ├── logs/                   #  9. 日志审计
│       │   │   ├── workflow/               # 10. 工作流引擎（DAG 编辑器）
│       │   │   └── shared/                 # 共享组件
│       │   ├── modals/                     # AgentConfigModal + tabs/
│       │   │   └── tabs/                   # SystemPromptTab, OutputConstraintTab, ToolsTab, MCPTab, SkillsTab
│       │   └── ...
│       ├── api/client/                     # API 客户端层（axios DI 模式）
│       │   ├── agents.ts, prompts.ts, tools.ts, skills.ts, sessions.ts, workflows.ts, ...
│       │   └── index.ts
│       ├── api/hooks.ts                    # TanStack Query hooks
│       ├── stores/chatStore.ts             # Zustand 状态管理
│       ├── i18n/                           # i18next 国际化（zh-CN/en-US）
│       ├── styles/                         # 15 个 CSS 文件（tokens + 模块化）
│       ├── types/                          # 全局类型
│       └── utils/                          # 工具函数（logger, errorHandler, sanitize...）
├── backend/                # Python FastAPI + SQLAlchemy 2.0 async + Celery
│   ├── app.py                   # FastAPI 入口（中间件: RateLimit → Auth → RequestLog → CORS → CSP）
│   ├── database.py              # ORM 模型（25 张表）
│   ├── models.py                # Pydantic 业务模型
│   ├── auth.py                  # JWT 认证 + RBAC (get_current_user / require_role)
│   ├── error_codes.py           # 结构化错误码体系 (23 codes)
│   ├── metrics.py               # Prometheus RED 指标端点
│   ├── routers/                 # API 路由（19 模块）
│   ├── observability/            # 可观测性（7 模块：EventStore + Trace + 自诊断）
│   │   ├── agents.py            # Agent CRUD + toggle
│   │   ├── prompts.py           # 提示词 CRUD
│   │   ├── tools.py             # 工具生成/验证 + CRUD（含 parameters）
│   │   ├── mcps.py              # MCP CRUD
│   │   ├── skills.py            # Skills 生成/验证 + CRUD
│   │   ├── teams.py             # 团队 CRUD + 成员管理 + link-agent
│   │   ├── keys.py              # API Key 加密存储
│   │   ├── sessions.py          # 会话 + runs 查询
│   │   ├── runs.py              # 运行状态 + 流式输出
│   │   ├── commands.py          # 命令面板
│   │   ├── attachments.py       # 附件管理
│   │   ├── models.py            # 可用模型列表
│   │   ├── admin.py             # 管理面板统计
│   │   ├── system_team.py       # AI 代理生成器端点
│   │   └── workflows.py         # 工作流 CRUD（DAG 配置）
│   ├── repository/              # 数据访问层（23 模块）
│   │   ├── agents.py, prompts.py, tools.py, mcps.py
│   │   ├── skills.py, teams.py, keys.py, core.py, workflows.py
│   │   └── __init__.py          # 统一导出
│   ├── agent_graph.py           # ⭐ LangGraph Agent 引擎（工具绑定+执行）
│   ├── workflow/dynamic_team_graph.py  # ⭐ 多 Agent 团队协作 LangGraph（DB 驱动）
│   ├── checkpoint.py            # 对话断点恢复 + create_checkpointer()
│   ├── system_team/             # AI 代理引擎（tool/skill 生成器）
│   ├── tasks.py                 # Celery 异步任务
│   └── tests/                   # pytest 测试（113 用例）
├── .env.example                 # 环境变量模板（21 vars）
├── pyproject.toml               # ruff + mypy + pytest 配置
├── requirements*.txt            # 分类: 运行时 / 开发 / 测试
├── alembic/                     # 数据库迁移（RBAC 初始迁移）
├── .github/workflows/ci.yml     # GitHub Actions 5-job 流水线
├── .husky/pre-commit            # lint-staged 提交钩子
├── docs/                        # 设计规范
└── .sisyphus/                   # 工作计划/草稿/笔记
```

---

## 🗄️ 数据库 Schema（25 张表）

### 核心运行时
| 表 | 模型 | 作用 |
|----|------|------|
| `sessions` | `SessionDB` | 对话会话 |
| `project_runs` | `ProjectRun` | 每次运行（→ sessions） |
| `chat_messages` | `ChatMessage` | 聊天消息（→ project_runs） |
| `memory_entries` | `MemoryEntry` | Agent 记忆（→ sessions） |
| `checkpoints` | `CheckpointDB` | 断点恢复（→ sessions） |

### 工作站管理
| 表 | 模型 | 作用 |
|----|------|------|
| `agent_configs` | `AgentConfigDB` | Agent 配置（含 embedded JSON + owner_id） |
| `prompts` | `PromptDB` | 提示词独立表（含 owner_id） |
| `registered_tools` | `RegisteredToolDB` | 工具注册表（含 `parameters` JSON Schema，owner_id） |
| `mcp_servers` | `MCPServerDB` | MCP 服务注册表（含 owner_id） |
| `registered_skills` | `RegisteredSkillDB` | Skills 注册表（含 owner_id） |
| `teams` | `TeamDB` | 团队（`name` UNIQUE + INDEX，含 owner_id） |
| `team_agents` | `TeamAgentDB` | 团队成员关联（→ teams, → agent_configs） |

### 安全与审计
| 表 | 模型 | 作用 |
|----|------|------|
| `user_api_keys` | `UserApiKey` | Fernet 加密 API Key |
| `key_usage_logs` | `KeyUsageLog` | LLM 调用审计 |
| `command_logs` | `CommandLogDB` | 命令执行日志 |
| `attachments` | `AttachmentDB` | 附件存储 |

### RBAC 表
| 表 | 模型 | 作用 |
|----|------|------|
| `users` | `UserDB` | 用户账户（username UNIQUE） |
| `roles` | `RoleDB` | 角色定义（admin/manager/member） |
| `user_roles` | `UserRoleDB` | 用户-角色多对多关联 |

### 外键关系速览
```
sessions (1) ──→ project_runs (N) ──→ chat_messages (N)
sessions (1) ──→ memory_entries (N)
sessions (1) ──→ agent_checkpoints (N)
agent_configs (1) ──→ team_agents (N) ← teams (1)
user_api_keys (1) ──→ key_usage_logs (N)
users (1) ──→ user_roles (N) ← roles (1)
```

---

## 🎯 工作台模块详解（全部 100/100 企业级）

> 入口：`WorkstationPage.tsx` | 共享组件：`workstation/shared/` (8 个)

### 模块文件约定

每个企业级模块包含：
```
module/
├── XxxManagement.tsx       # 主页面（表格/卡片，ErrorBoundary + i18n）
├── XxxFormModal.tsx        # 新建/编辑弹窗（memo + Escape + i18n）
├── xxx.types.ts            # TypeScript 类型
├── xxx.constants.ts        # 纯常量（不含 mock 数据）
├── mock-data.ts            # Mock 数据（独立文件）
├── api.ts                  # API 接口 + DI (setXxxAPI)
├── locales.ts              # 中英文翻译 (tuple 紧凑格式)
├── useXxxData.ts           # 数据 hook（API + error + retry）
├── useXxxUI.ts             # UI hook（菜单状态吸入 + 表单校验）
├── index.ts                # Barrel 导出
└── __tests__/              # 测试（6 用例标准）
```

### 各模块评分与文件清单

| 模块 | 评分 | 生产文件 | 测试 | 备注 |
|------|:---:|:--------:|:--:|------|
| **Prompt** | **100** | 11 文件 (Management+FormModal+types+constants+mock-data+api+locales+useData+useUI+useImportExport+index) | 3 测试 | 标杆模块 |
| **Output** | **100** | 10 文件 | 1 测试 | 单值 textarea 设计 |
| **Tool** | **100** | 10 文件 | 1 测试 | 完整 CRUD |
| **MCP** | **100** | 10 文件 | 2 测试 | FormModal 测试 |
| **Skill** | **100** | 10 文件 | 1 测试 | SkillGenerator 独有功能 |
| **Agent** | **100** | 9 文件 | 1 测试 | composite hook (useAgentManagement) |
| **Team** | **100** | 9 文件 | 1 测试 | data+UI split hooks |
| **Monitor** | **100** | 5 文件 | 1 测试 | 展示型（ErrorBoundary + smoke test） |
| **Logs** | **100** | 5 文件 | 1 测试 | 展示型 |
| **Settings** | **100** | 5 文件 | 1 测试 | 展示型 |

### 模块三层架构（跨模块引用）

```
AgentConfigModal.tsx (pickerItems 数据源)
├── tabs/SystemPromptTab.tsx      → 单值 textarea（提示词选择）
├── tabs/OutputConstraintTab.tsx  → 单值 textarea（输出约束）
├── tools/mcp/skills Tab          → ConfigItemList + FormModal（多条目列表）
AgentFormModal.tsx                → ResourcePickerModal（资源关联选择）
```

---

## 🔗 API 端点速查

### 提示词
```
GET    /api/prompts          列表
POST   /api/prompts          创建
PUT    /api/prompts/{id}     更新
DELETE /api/prompts/{id}     删除
```

### MCP 管理
```
GET    /api/mcps             列表
POST   /api/mcps             创建
PUT    /api/mcps/{id}        更新
DELETE /api/mcps/{id}        删除
```

### 工具管理
```
GET    /api/tools            列表
POST   /api/tools            创建
PUT    /api/tools/{id}       更新
DELETE /api/tools/{id}       删除
POST   /api/tools/generate   生成
POST   /api/tools/validate   验证
POST   /api/tools/execute    执行
```

### Skills 管理
```
GET    /api/skills           列表
POST   /api/skills           创建
PUT    /api/skills/{id}      更新
DELETE /api/skills/{id}      删除
POST   /api/skills/generate  生成
POST   /api/skills/validate  验证
```

### 其他端点
```
GET|POST           /api/agents            Agent CRUD
GET|POST|PUT|DLT   /api/teams             团队 CRUD
GET|PUT|DLT        /api/sessions          会话管理
GET                /api/runs              运行查询
GET|POST|PUT|DLT   /api/keys              API Key 管理
GET                /api/models            可用模型
GET|POST           /api/commands          命令面板
GET                /api/metrics           Prometheus 指标
GET|POST           /api/admin/stats|logs  管理统计
```

---

## 🛠️ 常用命令

### 前端
```bash
cd frontend
npm run dev              # 启动开发服务器
npm run build            # 生产构建 (tsc -b && vite build)
npm run typecheck        # TypeScript 类型检查
npm test                 # vitest 运行（216 用例 / 33 测试文件）
npm run lint             # ESLint 检查
npm run format           # Prettier 格式化
```

### 后端
```bash
cd .
PYTHONPATH=. python3 -m uvicorn backend.core.app:app --reload  # 启动 FastAPI
PYTHONPATH=. python3 -m pytest tests/                              # 运行测试
```

---

## ⚠️ 注意事项

1. **新增模块必须创建 `index.ts`** — 导入路径通过 `index.ts`，不要直接导入具体文件
2. **中文标签统一通过 `locales.ts` 的 `t()` 函数** — 支持中英文
3. **类型定义放在 `xxx.types.ts`**，Mock 数据独立于 `xxx.constants.ts` 放在 `mock-data.ts`
4. **API 抽象使用 DI 模式** — `setXxxAPI()` 便于测试替换
5. **所有组件包裹 ErrorBoundary** — `workstation/shared/ErrorBoundary.tsx`
6. **FormModal 使用 `React.memo` + Escape 关闭**
7. **后端遵循三层架构** — `database.py → repository/ → routers/`
8. **自定义工具执行** — `agent_graph.py` `_tools_node` 对无 handler 工具用 `self.llm.ainvoke()` 执行；`tasks.py` `bind_tools` 优先从 agent config JSON 取 description/parameters
9. **团队名唯一性** — DB `teams.name` UNIQUE + repository `create_team` 查重 → router 409
10. **文档同步规则** — 修改以下内容时，必须在**同一 commit** 同步更新 `AGENTS.md` 和 `CLAUDE.md`：
    - 新增/删除 router → 更新 routers 计数和列表
    - 新增/删除 repository → 更新 repository 列表
    - 新增/删除 DB model → 更新模型计数
    - 新增/删除 workstation 模块 → 更新模块列表和编号
    - 变更组件路径 → 更新文件树
    - 不遵循此规则的 PR 会被 CI `docs-check` job 拒绝

---

## 🛠 Agent 工具执行架构

```
Agent Config tools → tasks.py bind_tools → ToolConfig
  → agent_graph.SingleAgentGraph._tool_map → _ToolWrapper.invoke()
    ├─ calc/weather/search → 内置 handler
    ├─ mcp_* → MCP handler
    └─ 自定义工具 → _tools_node 检测 fallback → self.llm.ainvoke() 执行
```

`registered_tools` 有 `parameters` JSON Schema 列（`{"type":"object","properties":{...}}`），Agent Config 的 tools JSON 也存 parameters，`bind_tools` 优先取 agent config 中的值（自定义工具不入 registered_tools）。

---

## 🔄 更新日志

| 日期 | 更新内容 |
|------|---------|
| 2026-06-02 | 创建初始导航文件 |
| 2026-06-22 | **工作站 10 模块全部 100/100** — 前端企业级重构（Prompt/MCP/Output/Tool/Skill/Agent/Team/Monitor/Logs/Settings）|
| 2026-06-22 | 后端: +4 DB表（prompts/registered_tools/mcp_servers/registered_skills）+4 repository +2 router |
| 2026-06-22 | API: 新增 16 个端点，数据库 12→16 张表 |
| 2026-06-24 | **Enterprise Hardening 88→95+** — CI/CD + 后端测试 109 用例 + 持久化 checkpointer + RBAC（UserDB/RoleDB/Alembic）+ 工程化脚手架 |
| 2026-06-24 | **Enterprise Improvement** — Playwright infra + Prometheus /metrics + Husky hooks + ErrorCode 体系 + ErrorBoundary 解耦 |
| 2026-06-24 | **E2E 验证** — Chrome Playwright 全链路截图 + DeepSeek 工具调用修复（tool_calls=1 ✅）|

---

## 📝 会话记录

每次会话结束时，自动调用 `neat-freak` skill 生成结构化总结，写入 `.sisyphus/sessions/YYYY-MM-DD-topic.md`。

总结模板：Accomplished / Decisions / Patterns / Tech Debt / Next Steps。

### 跨会话引用
- 新会话需要上下文时，先从 `.sisyphus/sessions/` 查找相关记录
- 或在 `AGENTS.md` 中维护跨会话持久化知识
