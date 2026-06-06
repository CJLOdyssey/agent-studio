# Agent 配置系统架构设计

> 设计原则：单一职责、可复用、可追溯、可扩展

---

## 实体关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent 核心                               │
├─────────────────────────────────────────────────────────────────┤
│  agents (Agent 主表)                                             │
│    ├── agent_prompts (提示词，支持多版本)                         │
│    ├── agent_output_schemas (输出格式规范)                        │
│    │                                                            │
│    ├── agent_tool_bindings (N:N 关联) ──▶ tools (工具定义)       │
│    ├── agent_mcp_bindings (N:N 关联) ──▶ mcp_configs (MCP 定义)  │
│    └── agent_skill_bindings (N:N 关联) ──▶ skills (技能定义)      │
│                                                                 │
│  audit_logs (全局审计日志)                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 表结构设计

### 1. Agent 主表

```sql
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    role_identifier VARCHAR(32) NOT NULL,
    icon VARCHAR(8) DEFAULT '🤖',
    model VARCHAR(128),
    temperature FLOAT DEFAULT 0.7,
    is_active BOOLEAN DEFAULT TRUE,
    is_approver BOOLEAN DEFAULT FALSE,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, role_identifier)
);
```

### 2. 提示词表（支持版本管理）

```sql
CREATE TABLE agent_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    change_reason TEXT,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, version)
);
```

### 3. 输出格式规范表

```sql
CREATE TABLE agent_output_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    format_type VARCHAR(32) NOT NULL,       -- markdown, json, yaml
    schema_def JSONB NOT NULL,
    example TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. 工具定义表（全局可复用）

```sql
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    source_type VARCHAR(32) NOT NULL,       -- generated, imported, manual
    code TEXT,
    file_path VARCHAR(512),
    tool_def JSONB NOT NULL,
    parameters JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_tool_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    config_override JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, tool_id)
);
```

### 5. MCP 配置表（全局可复用）

```sql
CREATE TABLE mcp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    transport_type VARCHAR(32) NOT NULL,    -- stdio, sse, streamable_http
    command VARCHAR(256),
    args JSONB,
    env JSONB,
    url VARCHAR(512),
    headers JSONB,
    capabilities JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_mcp_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    mcp_id UUID NOT NULL REFERENCES mcp_configs(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    tool_filter JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, mcp_id)
);
```

### 6. 技能定义表（全局可复用）

```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    source_type VARCHAR(32) NOT NULL,       -- generated, imported, manual
    content TEXT NOT NULL,
    triggers JSONB,
    instructions TEXT,
    examples JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_skill_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    config_override JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id, skill_id)
);
```

### 7. 审计日志

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(32) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    field_name VARCHAR(64),
    old_value JSONB,
    new_value JSONB,
    changed_by VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 索引

```sql
CREATE INDEX idx_agent_prompts_agent ON agent_prompts(agent_id, is_active);
CREATE INDEX idx_agent_tool_bindings_agent ON agent_tool_bindings(agent_id);
CREATE INDEX idx_agent_mcp_bindings_agent ON agent_mcp_bindings(agent_id);
CREATE INDEX idx_agent_skill_bindings_agent ON agent_skill_bindings(agent_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_time ON audit_logs(created_at);
```

---

## 架构对比

| 维度 | 旧设计 (JSON 堆砌) | 新设计 (独立表) |
|---|---|---|
| **查询** | 无法高效查询工具列表 | `SELECT * FROM tools WHERE name LIKE '%web%'` |
| **复用** | 每个 Agent 重复存储 | 工具定义一次，多 Agent 共享 |
| **审计** | 无法追溯修改历史 | audit_logs 完整记录 |
| **版本** | 提示词无版本 | agent_prompts 支持多版本切换 |
| **扩展** | 加字段改表结构 | 新增表即可 |
| **一致性** | JSON 格式无约束 | 外键 + 约束保证数据完整 |

---

## API 设计

```
# Agent 管理
GET    /api/agents                    # 列出所有 Agent
POST   /api/agents                    # 创建 Agent
PUT    /api/agents/{id}               # 更新 Agent 基础信息
DELETE /api/agents/{id}               # 删除 Agent

# 提示词管理
GET    /api/agents/{id}/prompts       # 列出提示词版本
POST   /api/agents/{id}/prompts       # 创建新版本
PUT    /api/agents/{id}/prompts/{pid} # 更新提示词
POST   /api/agents/{id}/prompts/activate # 切换生效版本

# 输出格式管理
GET    /api/agents/{id}/schemas       # 列出输出格式
POST   /api/agents/{id}/schemas       # 创建格式
PUT    /api/agents/{id}/schemas/{sid} # 更新格式
DELETE /api/agents/{id}/schemas/{sid} # 删除格式

# 工具管理
GET    /api/tools                     # 列出所有工具
POST   /api/tools                     # 创建/导入工具
PUT    /api/tools/{id}                # 更新工具
DELETE /api/tools/{id}                # 删除工具
POST   /api/tools/generate            # 自然语言生成工具
POST   /api/tools/import              # 导入工具

# Agent ↔ Tool 绑定
GET    /api/agents/{id}/tools         # 列出 Agent 的工具
POST   /api/agents/{id}/tools         # 绑定工具
DELETE /api/agents/{id}/tools/{tid}   # 解绑工具

# MCP 管理 (同理)
GET    /api/mcp                       # 列出所有 MCP
POST   /api/mcp                       # 创建/导入 MCP
PUT    /api/mcp/{id}                  # 更新 MCP
DELETE /api/mcp/{id}                  # 删除 MCP

# Skill 管理 (同理)
GET    /api/skills                    # 列出所有技能
POST   /api/skills                    # 创建/导入技能
PUT    /api/skills/{id}               # 更新技能
DELETE /api/skills/{id}               # 删除技能
```
