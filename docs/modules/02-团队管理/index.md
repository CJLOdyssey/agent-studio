# 02 团队管理

## 业务闭环

```
创建团队 → 添加成员 → 配置 Agent (Prompt/模型/工具) → 保存 → 团队列表更新 → 选择团队发起对话
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `DevAgentsSidebar` (我的团队 + 按钮) · `AgentConfigModal` |
| **前端 Hook** | `useTeamManagement` (团队 CRUD API 调用) |
| **后端路由** | `teams.py` (团队 CRUD + 成员管理) · `agents.py` (Agent 配置 CRUD) |
| **数据库表** | `teams` · `team_members` · `agent_configs` |
| **核心逻辑** | Agent 配置包含 system_prompt, model, temperature, tools, mcp, skills |

## 数据流

```
创建团队 ──▶ POST /api/teams ──▶ teams 表
    │
    ▼
添加成员 ──▶ POST /api/teams/{id}/members ──▶ team_members 表
    │
    ▼
配置 Agent ──▶ PUT /api/agents/{id} ──▶ agent_configs 表
    │              (system_prompt, model, tools, skills)
    ▼
团队列表刷新 ◀── GET /api/teams ◀── 数据库查询
    │
    ▼
选择团队 ──▶ 发起对话时携带 agent_id
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/teams` | 列出所有团队 |
| POST | `/api/teams` | 创建团队 |
| PUT | `/api/teams/{id}` | 更新团队 |
| DELETE | `/api/teams/{id}` | 删除团队 |
| POST | `/api/teams/{id}/members` | 添加成员 |
| PUT | `/api/teams/{id}/members/reorder` | 成员排序 |
| DELETE | `/api/teams/{id}/members/{member_id}` | 移除成员 |
| GET | `/api/agents` | 列出所有 Agent 配置 |
| POST | `/api/agents` | 创建 Agent 配置 |
| PUT | `/api/agents/{id}` | 更新 Agent 配置 |
| DELETE | `/api/agents/{id}` | 删除 Agent 配置 |

## 数据库表

```sql
-- 团队表
CREATE TABLE teams (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    name VARCHAR(64) NOT NULL,
    "order" INTEGER DEFAULT 0,
    is_expanded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 团队成员表
CREATE TABLE team_members (
    id VARCHAR(36) PRIMARY KEY,
    team_id VARCHAR(36) REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    role VARCHAR(64) DEFAULT '待配置角色',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP
);

-- Agent 配置表
CREATE TABLE agent_configs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    name VARCHAR(64) NOT NULL,
    role_identifier VARCHAR(32) NOT NULL,
    system_prompt TEXT NOT NULL,
    output_constraints TEXT,
    tools JSONB,
    mcp JSONB,
    skills JSONB,
    model VARCHAR(128),
    temperature FLOAT,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_approver BOOLEAN DEFAULT FALSE,
    icon VARCHAR(8) DEFAULT '🤖',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```
