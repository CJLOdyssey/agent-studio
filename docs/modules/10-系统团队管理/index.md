# 10 系统团队管理

## 业务闭环

```
加载系统配置 → 列出 Agent/工具/技能 → 生成/编辑 → 保存 → 主 Agent 调用 → 完成任务
```

## 子模块

| 子模块 | 说明 |
|---|---|
| [tools-agent](tools-agent/) | 工具生成 Agent (tools_agent.yaml) |
| [skill-agent](skill-agent/) | 技能生成 Agent (skill_agent.yaml) |

## 层级实现

| 层级 | 实现 |
|---|---|
| **后端路由** | `system_team.py` (系统团队管理) |
| **配置文件** | `system_team/config.yaml` (团队配置) · `agents/*.yaml` (Agent 定义) |
| **前端组件** | `SystemTeamManagement` (系统团队管理页面) · `AgentChat` (对话界面) · `AgentList` (Agent 列表) · `ChatPanel` (聊天面板) |
| **前端 Hook** | `useSystemTeam` (系统团队管理) |

## 数据流

```
系统团队配置 (config.yaml)
    │
    ├── agents: [tools_agent, skill_agent, ...]
    ├── tools: [tool1, tool2, ...]
    └── skills: [skill1, skill2, ...]
    │
    ▼
GET /api/system-team
    │
    ▼
返回 Agent 列表 + 工具列表 + 技能列表
    │
    ▼
SystemTeamManagement 页面展示
    │
    ├── AgentList → 点击选择 Agent
    ├── ChatPanel → 输入需求
    │
    ▼
POST /api/system-team/chat
    │
    ▼
Agent 执行 → 生成工具/技能代码
    │
    ▼
保存到 tools/ 或 skills/ 目录
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/system-team` | 获取系统团队配置 |
| GET | `/api/system-team/agents` | 列出系统 Agent |
| GET | `/api/system-team/tools` | 列出系统工具 |
| GET | `/api/system-team/skills` | 列出系统技能 |
| POST | `/api/system-team/chat` | 与系统 Agent 对话 |

## 系统 Agent 定义

```yaml
# system_team/agents/tools_agent.yaml
name: tools_agent
description: 工具生成专家
system_prompt: |
  你是一个工具生成专家...
tools:
  - code_execution
  - file_operations
```
