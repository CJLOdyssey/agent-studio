# AgentStudio 项目结构全景

> 基于 codegraph 分析生成的完整项目结构视图
> 生成日期: 2026-07-28

---

## 顶层结构

```
agent-studio/
├── backend/          # Python FastAPI 后端
├── frontend/         # React 18 + Vite 6 前端
├── docs/             # 架构/设计/调研文档
├── scripts/          # 开发/CI/CD/部署脚本
├── docker/           # Docker Compose 配置
├── helm/             # Kubernetes Helm charts
├── data/             # 数据目录
├── uploads/          # 上传文件
│
├── pyproject.toml    # Python 项目配置 (ruff, mypy, pytest, coverage, mutmut, bandit)
├── Makefile
├── requirements.txt
├── alembic.ini       # 数据库迁移配置
├── .env.example      # 环境变量模板
├── .pre-commit-config.yaml
├── .githooks/
├── .github/          # GitHub Actions CI/CD
│
├── CHANGELOG.md
├── CONTRIBUTING.md
├── QUICKSTART.md
├── README.md
├── SECURITY.md
├── LICENSE (MIT)
└── CODE_OF_CONDUCT.md
```

---

## 🐍 后端架构

### 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | FastAPI (async) |
| ORM | SQLAlchemy async (psycopg3) |
| 迁移 | Alembic |
| Agent 引擎 | LangGraph |
| 认证 | JWT + RBAC |
| 加密 | Fernet 密钥保险箱 |
| 流式通信 | WebSocket + Redis Pub/Sub |
| 异步任务 | Celery |
| 可观测 | Prometheus metrics + SQLite EventStore + Trace |
| 数据库 | PostgreSQL (pgvector) |
| 缓存 | Redis |
| 质量 | ruff 120chars + mypy strict + coverage ≥ 89% + mutmut |

### 模块结构

```
backend/
├── main.py                          # CLI 入口 — 运行单 Agent (LangGraph)
│                                     # 用法: python -m backend.main "<requirement>"
│
├── core/                            # 核心基础设施
│   ├── app.py                       # FastAPI 应用工厂 (create_app)
│   ├── app_lifespan.py              # 应用生命周期
│   ├── config.py                    # 配置加载 (load_config)
│   ├── base.py                      # 基础类/接口
│   ├── _interfaces.py               # 内部接口
│   ├── models.py                    # 核心数据模型 (Pydantic)
│   ├── seed.py                      # 种子数据
│   ├── audit.py                     # 审计日志
│   ├── error_codes.py               # 错误码定义
│   ├── mock_fallback.py             # 降级/Fallback 策略
│   │
│   └── infra/                       # 基础设施组件 (14个)
│       ├── database.py              #   PostgreSQL 异步连接
│       ├── cache.py                 #   Redis 缓存层
│       ├── key_vault.py             #   🔐 Fernet 加密密钥保险箱
│       ├── events.py                #   事件发布/订阅
│       ├── metrics.py               #   Prometheus 指标
│       ├── rate_limit.py            #   限流
│       ├── logging_config.py        #   日志配置
│       ├── circuit_breaker.py       #   熔断器
│       ├── redis_sentinel.py        #   Redis Sentinel HA
│       ├── csp_middleware.py        #   Content-Security-Policy 中间件
│       ├── security_headers_middleware.py  # 安全头中间件
│       ├── request_logger.py        #   请求日志
│       └── request_size_middleware.py     # 请求大小限制
│
├── routers/                         # API 路由层 (19 模块)
│   ├── agents.py                    #   Agent CRUD
│   ├── teams.py                     #   团队 CRUD
│   ├── workflows.py                 #   工作流 CRUD
│   ├── prompts.py                   #   提示词管理
│   ├── tools.py                     #   工具管理
│   ├── mcps.py                      #   MCP 协议管理
│   ├── skills.py                    #   技能管理
│   ├── models.py                    #   模型配置
│   ├── providers.py                 #   供应商管理
│   ├── versions.py                  #   版本管理
│   ├── sessions.py                  #   会话管理
│   ├── runs.py                      #   运行管理
│   ├── commands.py                  #   命令执行
│   ├── keys.py                      #   API 密钥管理
│   ├── admin.py                     #   管理后台
│   ├── attachments.py               #   附件管理
│   ├── auth/                        #   认证路由子模块
│   ├── agent_test_handler.py        #   Agent 测试处理
│   └── run_continue.py              #   继续运行
│
├── repository/                      # 数据仓储层 (27 模块)
│   ├── base.py                      #   仓储基类
│   ├── deps.py                      #   依赖注入
│   ├── core.py                      #   核心仓储
│   ├── agents.py                    #   Agent 仓储
│   ├── teams.py                     #   团队仓储
│   ├── workflows.py                 #   工作流仓储
│   ├── prompts.py                   #   提示词仓储
│   ├── tools.py                     #   工具仓储
│   ├── mcps.py                      #   MCP 仓储
│   ├── skills.py                    #   技能仓储
│   ├── session_repo.py             #   会话仓储
│   ├── message_repo.py             #   消息仓储
│   ├── memory_repo.py              #   记忆仓储
│   ├── keys.py / keys_crud.py / keys_connectivity.py  # 密钥仓储
│   ├── admin_stats.py              #   管理统计
│   ├── audit.py                     #   审计仓储
│   ├── auth.py                      #   认证仓储
│   ├── command_logs.py             #   命令日志
│   ├── health.py                    #   健康检查
│   ├── versions.py                  #   版本仓储
│   ├── attachments.py              #   附件仓储
│   ├── snapshot_helper.py          #   快照辅助
│   └── ...
│
├── orm/                             # SQLAlchemy ORM 模型 (8 表)
│   ├── agent.py                     #   Agent 模型
│   ├── team.py                      #   团队模型
│   ├── workflow.py                  #   工作流模型
│   ├── session.py                   #   会话模型
│   ├── content.py                   #   内容/消息模型
│   ├── auth.py                      #   认证模型
│   ├── key.py                       #   密钥模型
│   └── __init__.py                  #   统一导出 (Base, 所有模型)
│
├── auth/                            # 认证授权层
│   ├── auth.py                      #   认证主模块
│   ├── auth_jwt.py                  #   JWT 令牌签发/验证
│   ├── auth_rbac.py                 #   RBAC 角色权限控制
│   ├── auth_middleware.py           #   Auth 中间件
│   └── password_policy.py           #   密码策略
│
├── graph/                           # LangGraph Agent 引擎
│   ├── graph.py                     #   SingleAgentGraph — ReAct 模式
│   ├── agent_graph.py              #   图构建/节点定义
│   └── graph_state.py              #   图状态类型定义
│
├── workflow/                        # 多 Agent DAG 编排引擎
│   ├── dynamic_team_graph.py       #   DynamicTeamGraph — DAG 并行
│   ├── graph_builder.py            #   图构建器 (从 DB 配置构建)
│   ├── node_factory.py             #   节点工厂
│   ├── router.py                    #   路由逻辑
│   ├── strategies.py               #   并行/聚合策略 (fan-out/fan-in)
│   ├── models.py                    #   工作流模型
│   └── migrate.py                   #   迁移兼容
│
├── tasks/                           # Celery 异步任务
│   ├── registry.py                  #   任务注册
│   ├── agent_pipeline.py           #   Agent 执行流水线
│   ├── team_pipeline.py            #   团队协作流水线
│   ├── complete_pipeline.py        #   完成处理流水线
│   ├── mcp_executor.py             #   MCP 任务执行器
│   └── prefix_completion.py        #   前缀补全
│
├── services/                        # 业务服务层
│   ├── run_service.py              #   运行服务
│   ├── tool_config.py              #   工具配置
│   ├── tool_generator.py           #   工具生成器
│   ├── tool_handlers.py            #   工具处理器
│   ├── email_service.py            #   邮件服务
│   └── generators/                  #   生成器模块
│
├── streaming/                       # 流式输出
│   ├── emitter.py                   #   StreamEmitter (Redis Pub/Sub 推送到前端)
│   └── llm_stream.py               #   LLM 流式响应处理
│
├── observability/                   # 可观测性
│   ├── store.py                     #   EventStore (SQLite 事件存储)
│   ├── trace.py                     #   分布式追踪
│   ├── handler.py                   #   事件处理器
│   ├── router.py                    #   可观测 API
│   ├── schema.py                    #   数据模式
│   ├── analyzer.py                  #   分析器
│   ├── startup_guard.py            #   启动检查
│   ├── events.db                    #   SQLite 存储文件
│   └── events.db-shm / -wal        #   SQLite WAL 文件
│
├── thinking_tree/                   # 思维树
│   ├── registry.py                  #   工具注册
│   └── tools/                       #   思维树工具集
│
├── checkpoint/                      # 检查点 (Agent 状态持久化)
├── rag/                             # RAG 检索增强生成
│   └── rag_store.py                 #   RAG 向量存储
├── uploads/                         # 上传文件处理
├── broker/                          # 消息代理
├── system_team/                     # 系统团队
│
├── alembic/                         # 数据库迁移
│   ├── env.py
│   ├── script.py.mako
│   └── versions/                    # 迁移版本
│
└── tests/                           # 测试 (35 个子目录/模块)
    ├── conftest.py / conftest_flaky.py / conftest_timeout.py
    ├── factories.py                 # 测试工厂
    ├── REQUIREMENTS.md              # 需求追踪
    │
    ├── auth/                        # 认证测试
    ├── routers/                     # 路由测试
    ├── repository/                  # 仓储测试
    ├── orm/                         # ORM 模型测试
    ├── core/                        # 核心测试
    ├── graph/                       # 图引擎测试
    ├── workflow/                    # 工作流测试
    ├── services/                    # 服务测试
    ├── tasks/                       # 任务测试
    ├── checkpoint/                  # 检查点测试
    ├── observability/               # 可观测性测试
    ├── streaming/                   # 流式测试
    ├── broker/                      # 代理测试
    ├── rag/                         # RAG 测试
    ├── thinking_tree/              # 思维树测试
    ├── system_team/                # 系统团队测试
    ├── contract/                    # 契约测试
    ├── e2e/                         # 端到端测试
    ├── integration/                 # 集成测试
    ├── benchmark/ / loadtests/     # 性能/负载测试
    ├── migration/                   # 迁移测试
    ├── mutation/                    # 变异测试
    │
    ├── test_auth_roles.py
    ├── test_continue_generation.py
    ├── test_rate_limit.py
    ├── test_security_headers_middleware.py
    └── test_requirement_markers.py / requirement_coverage.py
```

---

## ⚛️ 前端架构

### 技术栈

| 组件 | 技术 |
|------|------|
| 框架 | React 18.3 |
| 构建 | Vite 6 + TypeScript 5.6 |
| UI | Ant Design 5 + Tailwind CSS v4 |
| 状态 | Zustand + TanStack Query |
| 路由 | react-router-dom v6 |
| 流式 | WebSocket |
| 测试 | Vitest + Playwright + Testing Library |
| 质量 | eslint + prettier + TypeScript strict |

### 模块结构

```
frontend/
├── index.html
├── vite.config.ts                 # Vite + React + Tailwind + CSP
├── tsconfig.json
├── eslint.config.js
├── playwright.config.ts
├── nginx.conf                     # 生产 Nginx 配置
│
├── src/
│   ├── main.tsx                   # 入口 — ReactDOM.createRoot
│   ├── App.tsx                    # 根组件 (路由/布局)
│   ├── vite-env.d.ts
│   │
│   ├── api/                       # API 通信层
│   │   ├── client/                #    Axios API 客户端 (19 文件)
│   │   │   ├── instance.ts        #      Axios 实例 (拦截器/基础配置)
│   │   │   ├── index.ts           #      统一导出
│   │   │   ├── errors.ts          #      错误处理
│   │   │   │
│   │   │   ├── agents.ts          #      Agent 相关 API
│   │   │   ├── teams.ts           #      团队 API
│   │   │   ├── workflows.ts       #      工作流 API
│   │   │   ├── prompts.ts         #      提示词 API
│   │   │   ├── tools.ts           #      工具 API
│   │   │   ├── mcps.ts            #      MCP API
│   │   │   ├── skills.ts          #      技能 API
│   │   │   ├── sessions.ts        #      会话 API
│   │   │   ├── runs.ts            #      运行 API
│   │   │   ├── commands.ts        #      命令 API
│   │   │   ├── keys.ts            #      密钥 API
│   │   │   ├── auth.ts            #      认证 API
│   │   │   ├── admin.ts           #      管理后台 API
│   │   │   ├── providers.ts       #      供应商 API
│   │   │   └── versions.ts        #      版本 API
│   │   │
│   │   ├── hooks.ts               #    TanStack Query hooks (useQuery/useMutation)
│   │   └── websocket.ts           #    WebSocket 客户端
│   │
│   ├── stores/                    # Zustand 状态管理 (聊天/流式)
│   │   ├── chatStore.ts           #    聊天主状态
│   │   ├── chatActions.ts         #    聊天操作
│   │   ├── chatTypes.ts           #    类型定义
│   │   ├── chatStreaming.ts       #    流式状态
│   │   ├── streamHandler.ts       #    流处理
│   │   ├── messageHandler.ts      #    消息处理
│   │   ├── resultHandler.ts       #    结果处理
│   │   ├── wsEvents.ts            #    WebSocket 事件
│   │   └── uid.ts                 #    UID 生成
│   │
│   ├── hooks/                     # 自定义 Hooks (10 个)
│   │   ├── useConversation.ts     #    会话管理
│   │   ├── useAgentCommands.ts    #    Agent 命令
│   │   ├── useMessageComposer.ts  #    消息组合
│   │   ├── useTeamAgents.ts       #    团队 Agent
│   │   ├── useTeamData.ts         #    团队数据
│   │   ├── useTeamManagement.ts   #    团队管理
│   │   ├── useAutoSave.ts         #    自动保存
│   │   ├── useCommandPalette.ts   #    命令面板
│   │   └── useCopyToClipboard.ts  #    剪贴板
│   │   └── useItemList.ts         #    列表管理
│   │
│   ├── types/                     # TypeScript 类型定义
│   │   ├── index.ts
│   │   ├── AgentStudio.ts         #    AgentStudio 核心类型
│   │   ├── team.ts                #    团队类型
│   │   └── input.ts               #    输入类型
│   │
│   ├── components/
│   │   └── AgentStudio/           # 核心业务组件
│   │       ├── WorkstationPage.tsx           # 工作台页面入口
│   │       ├── AgentStudioWorkstation.tsx    # 工作台容器
│   │       ├── AgentStudioSidebar.tsx        # 侧边栏
│   │       ├── HomeScreen.tsx                # 首页
│   │       ├── GreetingAnimation.tsx         # 欢迎动画
│   │       ├── MessagesPanel.tsx             # 消息面板
│   │       ├── TeamMessage.tsx               # 团队消息
│   │       ├── Modals.tsx                    # 全局弹窗容器
│   │       ├── useDragAndDrop.ts             # 拖拽 Hook
│   │       ├── useWorkstationState.ts        # 工作台状态管理
│   │       │
│   │       ├── sidebar/                      # 侧边栏组件集
│   │       ├── modals/                       # 弹窗组件集
│   │       ├── messages/                     # 消息组件集
│   │       ├── workspace/                    # 工作区组件集
│   │       │
│   │       └── workstation/                  # 🏗 10 个工作台子模块
│   │           ├── types.ts                  #   模块共享类型
│   │           ├── utils.ts                  #   工具函数
│   │           ├── constants.ts              #   全局常量
│   │           ├── tabConfig.tsx             #   标签页配置
│   │           └── _hardcoded-defaults.ts    #   硬编码默认值
│   │           │
│   │           ├── shared/                   #   共享组件层 (18 文件)
│   │           │   ├── index.ts              #     统一导出
│   │           │   ├── useGenericCrud.ts     #     🔧 泛型 CRUD Hook
│   │           │   ├── useGenericCrud.types.ts
│   │           │   ├── api-base.ts           #     通用 API 基类
│   │           │   ├── CreateModal.tsx        #     创建弹窗
│   │           │   ├── BatchDeleteModal.tsx   #     批量删除
│   │           │   ├── DeleteConfirmModal.tsx #     删除确认
│   │           │   ├── VersionHistoryModal.tsx #    版本历史
│   │           │   ├── ResourcePickerModal.tsx #    资源选择器
│   │           │   ├── WstaPagination.tsx     #     分页组件
│   │           │   ├── WstaDropdownPortal.tsx #     下拉菜单 Portal
│   │           │   ├── EmptyState.tsx         #     空状态
│   │           │   ├── LoadingSkeleton.tsx    #     加载骨架屏
│   │           │   ├── ErrorBoundary.tsx      #     错误边界
│   │           │   ├── FormField.tsx          #     表单字段
│   │           │   ├── FormSelect.tsx         #     表单选择器
│   │           │   └── FormTextarea.tsx       #     表单文本域
│   │           │
│   │           ├── agent/                    # Agent 管理模块
│   │           │   ├── index.ts              #     模块入口 + 表格配置
│   │           │   ├── api.ts                #     API 定义
│   │           │   ├── agent.types.ts        #     类型定义
│   │           │   ├── agent.constants.ts    #     常量
│   │           │   ├── locales.ts            #     国际化
│   │           │   ├── validate.ts           #     表单验证
│   │           │   ├── mappers.ts            #     数据映射
│   │           │   ├── AgentManagement.tsx   #     管理页面
│   │           │   ├── AgentFormModal.tsx    #     表单弹窗
│   │           │   ├── ResourcePickerSection.tsx  # 资源选择
│   │           │   └── useAgentManagement.ts #     业务逻辑 Hook
│   │           │
│   │           ├── team/                     # 团队管理模块
│   │           │   ├── index.ts              #     模块入口
│   │           │   ├── api.ts                #     API
│   │           │   ├── team.types.ts         #     类型
│   │           │   ├── team.constants.ts     #     常量
│   │           │   ├── locales.ts            #     国际化
│   │           │   ├── validate.ts           #     验证
│   │           │   ├── TeamManagement.tsx    #     管理页面
│   │           │   ├── TeamFormModal.tsx     #     表单弹窗
│   │           │   ├── TeamMemberManager.tsx #     成员管理
│   │           │   ├── useTeamManagement.ts  #     Hook
│   │           │   └── useTeamMemberManager.ts #   成员 Hook
│   │           │
│   │           ├── prompt/                   # 提示词管理模块
│   │           ├── tool/                     # 工具管理模块
│   │           ├── mcp/                      # MCP 协议管理模块
│   │           ├── skill/                    # 技能管理模块
│   │           ├── workflow/                 # 工作流管理模块
│   │           ├── monitor/                  # 监控面板模块
│   │           ├── logs/                     # 审计日志模块
│   │           └── output/                   # 输出模块
│   │
│   ├── contexts/                    # React Contexts
│   ├── utils/                       # 工具函数
│   ├── styles/                      # 样式文件
│   ├── i18n/                        # 国际化 (zh-CN / en)
│   ├── mocks/                       # Mock 数据
│   ├── test/                        # 测试工具/辅助
│   └── __tests__/                   # 根级测试
│
├── e2e/                             # Playwright E2E 测试
│   └── smoke_tests.py              # 灰盒冒烟测试
├── dist/                            # 构建输出
├── public/                          # 静态资源
├── coverage/                        # 覆盖率报告
│
└── Dockerfile / nginx.conf          # 容器化部署
```

---

## 📜 脚本工具

```
scripts/
├── dev/                             # 开发工具
│   ├── preflight.py                # 环境预检 (DB/Redis/磁盘/端口)
│   ├── check-docs.js               # 文档一致性检查
│   └── requirement_coverage.py     # 需求覆盖率报告
│
├── ci/                              # CI 工具
│   └── check-docs-sync.py          # AGENTS.md 与实际代码同步检查
│
├── deploy/                          # 部署工具
└── docs/                            # 文档生成工具
```

---

## 📚 文档

```
docs/
├── architecture/                    # 架构设计文档
├── design-references/              # 设计参考
├── research/                        # 技术调研
├── superpowers/                     # Superpowers 技能相关
└── frontend-ui-optimization.md     # 前端 UI 优化指南
```

---

## 🧩 核心数据流

```
用户交互
    │
    ▼
Frontend (React + Vite)
    │  Axios API 调用
    │  WebSocket 订阅
    ▼
Backend (FastAPI)
    │
    ├──► routers/     → 请求路由
    ├──► auth/        → JWT + RBAC 认证
    ├──► repository/  → 数据访问 (SQLAlchemy)
    ├──► graph/       → SingleAgentGraph (ReAct)
    ├──► workflow/    → DynamicTeamGraph (DAG)
    ├──► streaming/   → StreamEmitter → Redis Pub/Sub
    ├──► tasks/       → Celery 异步任务
    └──► observability/ → EventStore + Trace + Metrics
```

**Agent 执行流:**
```
用户输入 → WebSocket → Router → SingleAgentGraph/DynamicTeamGraph
    → LLM 调用 → 工具调用 → StreamingEmitter
    → Redis Pub/Sub → WebSocket → 前端渲染
```

**双引擎执行模式:**
| 引擎 | 场景 | 架构模式 |
|------|------|---------|
| `SingleAgentGraph` | 单 Agent 对话 | ReAct 模式，思考链流式输出 |
| `DynamicTeamGraph` | 多 Agent 工作流 | DAG 编排，fan-out/fan-in 并行 |
