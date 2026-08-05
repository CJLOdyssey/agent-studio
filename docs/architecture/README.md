# AgentStudio 项目架构

> 按用户工作流（User Workflow）划分，非传统 DDD 或分层架构。

---

## 完整架构树

```
AgentStudio
│
├── [1. 工作区配置](workflows/01-workspace-config.md)
│   ├── 1.1 团队管理
│   │   ├── 功能：团队 CRUD / 成员管理 / 团队分类
│   │   ├── FE: TeamTree, TeamManagement, TeamFormModal, TeamMemberManager
│   │   ├── BE: routers/teams.py → repository/teams.py
│   │   └── DB: teams, team_agents
│   │
│   ├── 1.2 Agent 配置
│   │   ├── 功能：Agent CRUD / 启用禁用 / 关联 Tool/MCP/Skill/Prompt / 测试 / 版本快照
│   │   ├── FE: AgentManagement, AgentFormModal, ResourcePickerSection
│   │   ├── BE: routers/agents.py → repository/agents.py
│   │   └── DB: agent_configs, versions
│   │
│   ├── 1.3 工具管理
│   │   ├── 功能：Tool CRUD / 分类 / 语法校验 / 执行测试 / 连接测试
│   │   ├── FE: ToolManagement, ToolFormModal
│   │   ├── BE: routers/tools.py → repository/tools.py
│   │   └── DB: registered_tools
│   │
│   ├── 1.4 MCP 管理
│   │   ├── 功能：MCP CRUD / 类型 / 连接测试
│   │   ├── FE: MCPManagement, MCPFormModal
│   │   ├── BE: routers/mcps.py → repository/mcps.py
│   │   └── DB: mcp_servers
│   │
│   ├── 1.5 Skill 管理
│   │   ├── 功能：Skill CRUD / 分类
│   │   ├── FE: SkillManagement, SkillFormModal
│   │   ├── BE: routers/skills.py → repository/skills.py
│   │   └── DB: registered_skills
│   │
│   ├── 1.6 提示词管理
│   │   ├── 功能：Prompt CRUD / 按分类过滤 / 版本快照 / 分类 / AI 生成 / 语法校验
│   │   ├── FE: PromptManagement, PromptFormModal
│   │   ├── BE: routers/prompts.py → repository/prompts.py
│   │   └── DB: prompts, versions
│   │
│   ├── 1.7 输出约束管理
│   │   ├── 功能：CRUD（复用 Prompt 表） / 分类
│   │   ├── FE: OutputConstraintManagement, OutputFormModal
│   │   ├── BE: 复用 routers/prompts.py → repository/prompts.py
│   │   └── DB: prompts（按 category 过滤）
│   │
│   └── 1.8 工作流管理
│       ├── 功能：工作流 CRUD / 按团队查询 / 可视化编辑器 / DAG 定义
│       ├── FE: WorkflowManagement, WorkflowEditor
│       ├── BE: routers/workflows.py → repository/workflows.py
│       └── DB: workflow_configs, workflow_nodes, workflow_edges
│
├── [2. 对话运行](workflows/02-conversation.md)
│   ├── 2.1 消息输入与发送
│   │   ├── 功能：多行输入框 / 模型选择 / 文件附件 / 命令面板 / 停止生成
│   │   └── FE: InputToolbar, ModelSelector, FileAttach, CommandDropdown
│   │
│   ├── 2.2 消息展示与交互
│   │   ├── 功能：消息气泡 / 思考折叠 / 复制编辑重新生成 / 版本切换 / 继续生成 / 代码块
│   │   └── FE: MessagesPanel, TeamMessage, CodeBlock, CopyBtn
│   │
│   ├── 2.3 对话列表与导航
│   │   ├── 功能：按时间分组 / 虚拟滚动 / localStorage / 更多菜单 / 新建对话
│   │   ├── FE: ConversationsList, AgentStudioSidebar
│   │   └── BE: GET /api/sessions → repository/session_repo.py → DB: sessions
│   │
│   ├── 2.4 Agent 执行引擎
│   │   ├── 功能：SingleAgent ReAct / DynamicTeam DAG / 流式输出 / Tool 调用 / Checkpoint
│   │   └── BE: graph/graph.py, workflow/, streaming/, checkpoint/
│   │
│   └── 2.5 消息状态管理
│       └── FE: chatStore, chatActions, chatStreaming, streamHandler, messageHandler, resultHandler
│
├── [3. 会话持久化](workflows/03-session-persistence.md)
│   ├── 3.1 会话管理
│   │   ├── 功能：会话 CRUD / 关联 runs / 关联 messages / sessionId 映射
│   │   ├── FE: useConversation
│   │   ├── BE: routers/sessions.py → repository/session_repo.py
│   │   └── DB: sessions, project_runs, chat_messages
│   │
│   ├── 3.2 消息存储
│   │   ├── 功能：实时流式写入 / 内容+思考+版本
│   │   ├── BE: RunService → repository/message_repo.py
│   │   └── DB: chat_messages
│   │
│   ├── 3.3 记忆管理
│   │   ├── 功能：记忆列表 / 删除 / 导出 JSON/MD
│   │   ├── BE: routers/sessions.py → repository/memory_repo.py
│   │   └── DB: memory_entries
│   │
│   └── 3.4 对话记录本地持久化
│       ├── 功能：localStorage 即时写入 / 刷新恢复 / WS 断开同步
│       └── FE: useConversation + useWorkstationState
│
├── [4. 模型与密钥](workflows/04-models-keys.md)
│   ├── 4.1 API 密钥管理
│   │   ├── 功能：密钥 CRUD / Fernet 加密 / 掩码 / 连通测试 / 用量统计 / 拉取模型 / 匿名回落
│   │   ├── FE: ApiManagementModal, ApiProviderTab, ApiUsageTab, ProviderEditModal
│   │   ├── BE: routers/keys.py → repository/keys_crud.py
│   │   └── DB: user_api_keys, key_usage_logs
│   │
│   └── 4.2 模型管理
│       ├── 功能：可用模型列表 / 模型选择 / localStorage 持久化
│       ├── FE: ModelSelector（输入框 + 弹窗）
│       ├── BE: routers/models.py → repository/keys_crud.py
│       └── DB: user_api_keys.models 字段
│
├── [5. 知识检索](workflows/05-knowledge-retrieval.md)
│   ├── 5.1 文件上传与管理
│   │   ├── 功能：上传 / 下载 / 按会话关联
│   │   ├── BE: routers/attachments.py
│   │   └── DB: attachments
│   │
│   ├── 5.2 文档处理管道
│   │   ├── 功能：文本提取 / 分块 / 向量化 / 向量存储
│   │   └── BE: rag/rag_chunking.py, rag/rag_embedding.py, rag/rag_store.py
│   │
│   └── 5.3 检索问答
│       ├── 功能：向量搜索 / 上下文注入 / 引用生成
│       └── BE: rag/rag_pipeline.py
│
├── [6. 认证与用户](workflows/06-auth.md)
│   ├── 6.1 登录
│   │   ├── 功能：邮箱密码登录 / Token 刷新 / 登出
│   │   ├── FE: LoginModal（登录 Tab）
│   │   ├── BE: auth/login.py → repository/auth.py
│   │   └── DB: users, refresh_tokens
│   │
│   ├── 6.2 注册
│   │   ├── 功能：发送验证码 / 注册 / 邮箱验证 / 重新发送
│   │   ├── FE: LoginModal（注册 Tab）
│   │   ├── BE: auth/register.py → repository/auth.py
│   │   └── DB: users, Redis
│   │
│   ├── 6.3 密码管理
│   │   ├── 功能：忘记密码 / 重置密码 / 修改密码
│   │   ├── FE: ForgotPasswordForm
│   │   ├── BE: auth/password.py → repository/auth.py
│   │   └── DB: users, Redis
│   │
│   ├── 6.4 用户信息与状态
│   │   ├── 功能：GET /me / Auth 配置 / 访客合并 / 用户菜单
│   │   ├── FE: AuthContext, UserMenu, PasswordStrengthIndicator
│   │   ├── BE: auth/profile.py → repository/auth.py
│   │   └── DB: users, user_roles, roles
│   │
│   └── 6.5 权限控制
│       ├── 功能：JWT 签发校验 / RBAC 中间件 / 路由豁免 / AuthMiddleware
│       └── BE: auth/auth_jwt.py, auth/auth_middleware.py, auth/auth_rbac.py
│
├── [7. 运维监控](workflows/07-operations.md)
│   ├── 7.1 仪表盘
│   │   ├── 功能：统计概览 / 最近活动 / 系统健康 / 定时刷新
│   │   ├── FE: MonitorCenter, MonitorStats, MonitorActivity, MonitorHealth
│   │   ├── BE: routers/admin.py → repository/admin_stats.py
│   │   └── DB: 多表聚合
│   │
│   ├── 7.2 审计日志
│   │   ├── 功能：命令执行日志 / 操作审计
│   │   ├── FE: LogAudit
│   │   ├── BE: routers/admin.py → repository/admin_stats.py
│   │   └── DB: command_logs, audit_logs
│   │
│   └── 7.3 Debug 工具
│       ├── 功能：事件查询 / Trace 分析 / 错误报告 / Circuit Breaker / Startup Guard
│       └── BE: observability/router.py, analyzer.py, store.py, startup_guard.py
│
├── [8. 通用基础设施](workflows/08-common.md)
│   ├── 8.1 应用壳
│   │   ├── 功能：路由 / 主题切换 / CSS 变量 / 国际化 / 首页 / 工作台入口 / 弹窗管理
│   │   └── FE: App.tsx, ThemedApp, AuthGate, HomeScreen, AgentStudioWorkstation
│   │
│   ├── 8.2 通用组件
│   │   ├── 功能：Modal（focus trap + ARIA）/ LoadingSkeleton / EmptyState / ErrorState / ToggleSwitch
│   │   └── FE: shared/Modal, shared/LoadingSkeleton, shared/EmptyState, shared/ErrorState, shared/ToggleSwitch
│   │
│   ├── 8.3 工作台通用
│   │   ├── 功能：CRUD 模块基类 / 分页 / 表单组件 / 确认弹窗 / 版本历史弹窗
│   │   └── FE: workstation/shared/api-base, WstaPagination, FormField, FormSelect, FormTextarea, CreateModal
│   │
│   ├── 8.4 版本管理
│   │   ├── 功能：版本快照创建 / 列表 / 详情
│   │   ├── BE: routers/versions.py → repository/versions.py
│   │   └── DB: versions
│   │
│   └── 8.5 命令面板
│       ├── 功能：内置命令 / 执行调度 / 执行日志
│       ├── FE: CommandDropdown
│       ├── BE: routers/commands.py → repository/command_logs.py
│       └── DB: command_logs
│
└── [9. 思维树](workflows/09-thinking-tree.md)
    ├── 功能：Thinking Tool 注册表
    ├── 功能：Tavily 搜索工具
    └── BE: thinking_tree/registry.py, thinking_tree/tools/
```

---

## 统计

| 工作流 | 模块数 | 功能数 | ❌ 未实现 | ⚠️ 需验证 |
|--------|--------|--------|----------|----------|
| [1. 工作区配置](workflows/01-workspace-config.md) | 8 | ~55 | 9 | 0 |
| [2. 对话运行](workflows/02-conversation.md) | 5 | ~30 | 2 | 1 |
| [3. 会话持久化](workflows/03-session-persistence.md) | 4 | ~10 | 0 | 0 |
| [4. 模型与密钥](workflows/04-models-keys.md) | 2 | ~13 | 0 | 0 |
| [5. 知识检索](workflows/05-knowledge-retrieval.md) | 3 | ~7 | 0 | 1 |
| [6. 认证与用户](workflows/06-auth.md) | 5 | ~15 | 0 | 0 |
| [7. 运维监控](workflows/07-operations.md) | 3 | ~10 | 0 | 0 |
| [8. 通用基础设施](workflows/08-common.md) | 5 | ~15 | 0 | 0 |
| [9. 思维树](workflows/09-thinking-tree.md) | 1 | ~2 | 0 | 1 |
| **总计** | **36** | **~157** | **11** | **3** |

---

## 模块状态图例

| 标记 | 含义 |
|------|------|
| ✅ | 完整实现（FE + BE + DB 全链路） |
| ⚠️ | 需验证（功能已实现但未测试验证） |
| ❌ | 未实现（前端/后端缺其一） |
