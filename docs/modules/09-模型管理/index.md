# 09 模型管理

## 业务闭环

```
配置 API 密钥 → 提取可用模型列表 → 下拉框展示 → 用户选择 → 绑定到 Agent → 调用时使用
```

## 层级实现

| 层级 | 实现 |
|---|---|
| **前端组件** | `AgentConfigModal` (模型下拉框) |
| **前端 Hook** | `useModels` (模型列表加载) |
| **后端路由** | `models.py` (模型提取/列表) |
| **数据库表** | `agent_configs` (model 字段) |

## 数据流

```
用户配置 API 密钥
    │
    ▼
GET /api/models?api_key_id={id}
    │
    ▼
后端调用 LLM Provider API
    │
    ├── OpenAI: GET /v1/models
    ├── Azure: GET /openai/deployments
    └── 其他: 适配器提取
    │
    ▼
返回模型列表
    │
    ▼
AgentConfigModal 下拉框展示
    │
    ▼
用户选择模型 → 保存到 agent_configs.model
    │
    ▼
Agent 执行时 → 使用绑定的模型
```

## API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/models` | 获取模型列表 |
| GET | `/api/models/providers` | 获取支持的 Provider |

## 支持的 Provider

| Provider | 基础 URL | 示例模型 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini` |
| Azure | 用户自定义 | 部署名 |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 本地 | `http://localhost:11434/v1` | `ollama` |

## 数据库表

```sql
-- agent_configs 表中的模型字段
ALTER TABLE agent_configs ADD COLUMN model VARCHAR(128);
-- 示例值: "openai/gpt-4o" 或 "deepseek/deepseek-chat"
```
