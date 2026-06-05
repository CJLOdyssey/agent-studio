# 架构详解

## 整体架构

```
┌─ 用户浏览器 ─────────────────────────────────────┐
│  React 18 + TypeScript + Vite 6 + Zustand 5      │
│  DeepSeek 暗色主题 UI                            │
│  页面: Home / Chat / History / AgentConfig        │
└──────────┬──────────────┬────────────────────────┘
           │ HTTP /api/*   │ WebSocket /ws/*
           ▼              ▼
┌─ Nginx (80) ─────────────────────────────────────┐
│  / → frontend/dist/ 静态文件                     │
│  /api/* → proxy_pass api:8080                    │
│  /ws/*  → proxy_pass api:8080 (WebSocket)        │
└───────────────────┬──────────────────────────────┘
                    │
┌─ FastAPI (8080) ─────────────────────────────────┐
│  POST /api/runs       创建讨论                   │
│  GET  /api/runs       历史列表                   │
│  GET  /api/runs/{id}  详情 + 消息                │
│  WS   /ws/runs/{id}   实时流推送                 │
│  GET/POST /api/agents  Agent 配置 CRUD           │
│  PUT/DEL /api/agents/{id}                        │
│  GET  /api/health     健康检查                   │
└────┬─────────────────────┬──────────────────────┘
     │ Celery               │ Redis Pub/Sub
     ▼                      ▼
┌─ Celery Worker ───┐   ┌─ Redis ──────────────┐
│  run_discussion   │   │  Broker + Result Back │
│  TeamManager      │   │  Pub/Sub 消息流       │
│  AutoGen GroupChat│   └──────────────────────┘
└────┬──────────────┘
     │ SQLAlchemy async
     ▼
┌─ PostgreSQL 16 ─────────────────────────────────┐
│  project_runs   (需求/文档/代码/评审/状态)      │
│  chat_messages  (每轮对话全文)                  │
│  agent_configs  (动态 Agent 配置)               │
└────────────────────────────────────────────────┘
```

---

## 组件详解

### 1. 前端 (React SPA)

**页面路由：**

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | Home | 输入需求，启动讨论 |
| `/chat/:runId` | Chat | 实时对话流展示 |
| `/history` | History | 历史讨论列表 |
| `/agents` | AgentConfig | 管理 Agent 配置 |

**状态管理 (Zustand)：**

- `useChatStore` — 当前对话消息、加载状态
- `useAgentStore` — Agent 配置列表
- `useHistoryStore` — 历史记录

**API 客户端 (`api/client.ts`)：**

- Axios 实例，baseURL: `/api`
- WebSocket 连接管理器

### 2. 后端 (FastAPI)

**API 端点详情：**

| 方法 | 路径 | 参数 | 响应 | 说明 |
|------|------|------|------|------|
| POST | `/api/runs` | `{requirement: string}` | `{run_id, status}` | 创建讨论 → Celery 入队 |
| GET | `/api/runs` | `?limit=20` | Run[] | 历史列表 |
| GET | `/api/runs/{id}` | — | Run + Message[] | 详情 |
| GET | `/api/agents` | — | AgentConfig[] | 所有 Agent 配置 |
| POST | `/api/agents` | AgentCreate | AgentConfig | 新增 Agent |
| PUT | `/api/agents/{id}` | AgentUpdate | AgentConfig | 编辑 Agent |
| DELETE | `/api/agents/{id}` | — | — | 删除 Agent |
| PUT | `/api/agents/{id}/toggle` | — | AgentConfig | 启停切换 |
| GET | `/api/health` | — | `{status: "ok"}` | 健康检查 |

### 3. 数据库模型

**project_runs 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| requirement | Text | 用户输入需求 |
| pm_document | Text | PM 输出文档 |
| code | Text | 程序员输出代码 |
| review | Text | 测试员审查意见 |
| approved | Boolean | 是否批准 |
| status | Enum | pending/running/completed/error |
| created_at | Timestamp | 创建时间 |
| updated_at | Timestamp | 更新时间 |

**chat_messages 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID (PK) | 主键 |
| run_id | UUID (FK→runs) | 关联讨论 |
| role | Text | 角色标识 |
| agent_name | Text | Agent 名称 |
| content | Text | 消息内容 |
| round_number | Integer | 轮次编号 |
| created_at | Timestamp | 创建时间 |

**agent_configs 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer (PK) | 主键 |
| name | Text | 显示名称 |
| role_identifier | Text | 角色 ID |
| system_prompt | Text | 系统提示词 |
| model | Text | 覆盖模型 |
| temperature | Float | 覆盖温度 |
| order | Integer | 发言顺序 |
| is_active | Boolean | 是否启用 |
| is_approver | Boolean | 是否有批准权 |
| icon | Text | 显示图标 |
| created_at | Timestamp | 创建时间 |

### 4. Agent 系统设计

**动态 Agent 创建：**

```
agent_configs 表 (DB)
    ↓ 加载 is_active=true 的记录
    ↓ 按 order 排序
AgentFactory.create_agent_from_config(config)
    ↓ system_prompt → AutoGen AssistantAgent
    ↓ 可覆盖 model / temperature
TeamManager
    ↓ GroupChat + GroupChatManager
    ↓ UserProxyAgent 作为入口
    ↓ 按 order 轮询 speaker 选择
```

**发言顺序控制：**

- 按 `agent_configs.order` 排序
- `TeamManager.select_speaker()` 按顺序选择下一个未发言的 Agent
- 测试员发言后检查是否包含批准关键词
- UserProxy 全程旁听，不做技术发言

**终止条件：**

1. 测试员消息包含 `APPROVAL_KEYWORD`（批准关键词）
2. 达到 `MAX_ROUNDS` 最大轮数

**输出提取 (`extractors.py`)：**

- PM 文档：正则匹配 `文档` 标记
- 代码：正则匹配代码块（标记名 → 文件名映射）
- 评审：正则匹配 `审查意见` / `评审` 标记
- `extract_all(messages)` 一次性提取所有输出

### 5. 模块依赖关系

```
webapp.py
  ├── virtual_team.config        — TeamConfig 加载
  ├── virtual_team.database      — async engine + Base
  ├── virtual_team.repository    — 所有 DB CRUD
  ├── virtual_team.celery_app    — Celery 实例
  └── virtual_team.redis_client  — Redis pub/sub

virtual_team/tasks.py (Celery)
  ├── virtual_team.config        — Load team config
  ├── virtual_team.conversation  — TeamManager
  ├── virtual_team.repository    — DB operations
  └── virtual_team.redis_client  — Publish messages

virtual_team/conversation.py
  ├── virtual_team.agents        — Agent factory
  ├── virtual_team.config
  ├── virtual_team.extractors    — Output extraction
  └── virtual_team.models        — Pydantic models

virtual_team/repository.py
  ├── virtual_team.database      — ORM models + session
  ├── virtual_team.agent_defaults — DEFAULT_AGENTS
```

### 6. 完整数据流

```
用户输入 "写一个贪吃蛇游戏"
  → POST /api/runs {requirement: "写一个贪吃蛇游戏"}
    → repository.create_run()           → 写入 project_runs (pending)
    → run_discussion.delay(requirement) → Celery 入队
    → 返回 {run_id, status: "pending"}
  → 前端连接 WebSocket /ws/runs/{run_id}
    → FastAPI ws 端点 accept → Redis subscribe(run_id)

Celery Worker:
  → Load active agents from DB (按 order 排序)
  → 创建 TeamConfig + GroupChat + GroupChatManager
  → UserProxy.initiate_chat("用户需求：写一个贪吃蛇游戏")

  第1轮: PM   → 输出需求文档
          → Redis publish → WS → 前端渲染
  第2轮: 程序员 → 输出代码
          → Redis publish → WS → 前端渲染
  第3轮: 测试员 → 审查并输出意见
          → Redis publish → WS → 前端渲染

  ...重复直到：
    1. 测试员发言包含 "【批准】" → 终止
    2. 达到 MAX_ROUNDS         → 强制终止

  终止后:
  → extract_all(messages) → 提取文档/代码/评审
  → repository.update_run(...) → 写入 project_runs (completed)
  → Redis publish {type: "result", ...} → WS → 前端显示结果
```

### 7. 容器化编排

| 服务 | 镜像 | 依赖 | 说明 |
|------|------|------|------|
| postgres | postgres:16-alpine | — | 数据库 (healthcheck) |
| redis | redis:7-alpine | — | 消息队列 (healthcheck) |
| api | Dockerfile (python:3.12) | postgres, redis | FastAPI + healthcheck |
| celery_worker | Dockerfile (python:3.12) | postgres, redis, api | Celery worker |
| frontend | nginx:alpine | api | Nginx 反代 + 静态文件 |

### 8. CI/CD 流水线

```
Push → CI Gate (GitHub API 查询 CI 状态)
     → Build & Push to ACR (registry.cn-shenzhen.aliyuncs.com)
     → Deploy to ECS (self-hosted runner)
       → docker compose pull
       → docker compose up -d
       → image prune
       → webhook 通知
```
