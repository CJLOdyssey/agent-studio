# API 使用示例

> FastAPI 自动生成 OpenAPI 文档：启动后端后访问 `/docs`（Swagger）或 `/redoc`（ReDoc）。
> 本文档补充常见业务场景的请求/响应示例。

---

## 认证

### 注册

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "email": "alice@example.com", "password": "SecurePass123!"}'
```

响应：
```json
{
  "id": "uuid",
  "username": "alice",
  "email": "alice@example.com",
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

### 登录

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "alice", "password": "SecurePass123!"}'
```

### 使用 JWT 调用受保护接口

```bash
curl http://localhost:8080/api/agents \
  -H "Authorization: Bearer eyJ..."
```

---

## Agent 管理

### 创建 Agent

```bash
curl -X POST http://localhost:8080/api/agents \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "代码审查助手",
    "roleIdentifier": "code_reviewer",
    "systemPrompt": "你是一个资深的代码审查专家。",
    "model": "deepseek-chat",
    "temperature": 0.3
  }'
```

### 列出 Agent

```bash
curl http://localhost:8080/api/agents -H "Authorization: Bearer eyJ..."
```

### 获取 Agent 详情

```bash
curl http://localhost:8080/api/agents/{agent_id} -H "Authorization: Bearer eyJ..."
```

---

## 运行

### 创建新运行（单 Agent）

```bash
curl -X POST http://localhost:8080/api/runs \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "用 Python 写一个斐波那契函数",
    "agentId": "agent-uuid",
    "sessionId": "session-uuid"
  }'
```

响应：
```json
{
  "runId": "run-uuid",
  "status": "pending",
  "sessionId": "session-uuid"
}
```

### 运行团队工作流

```bash
curl -X POST http://localhost:8080/api/runs \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "设计一个微服务架构",
    "teamId": "team-uuid"
  }'
```

### WebSocket 流式接收运行结果

```javascript
// 浏览器端
const ws = new WebSocket("ws://localhost:8080/ws/runs/{run_id}");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case "status":
      console.log("状态:", msg.status);       // connected | running | error
      break;
    case "message":
      console.log(`[${msg.role}] ${msg.content}`);
      break;
    case "result":
      console.log("最终结果:", msg);
      break;
  }
};
```

---

## 工作流配置

### 创建团队

```bash
curl -X POST http://localhost:8080/api/teams \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "内容创作团队",
    "description": "编写 + 审查 + 发布"
  }'
```

### 创建工作流 DAG

```bash
curl -X POST http://localhost:8080/api/workflows \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "team-uuid",
    "name": "三步骤流水线",
    "nodes": [
      {"agentConfigId": "writer-id", "roleIdentifier": "writer", "strategy": "generator", "order": 1},
      {"agentConfigId": "reviewer-id", "roleIdentifier": "reviewer", "strategy": "reviewer", "order": 2},
      {"agentConfigId": "publisher-id", "roleIdentifier": "publisher", "strategy": "reporter", "order": 3}
    ],
    "edges": [
      {"fromNodeId": "writer", "toNodeId": "reviewer"},
      {"fromNodeId": "reviewer", "toNodeId": "publisher", "conditionKey": "approved"},
      {"fromNodeId": "reviewer", "toNodeId": "writer", "conditionKey": "rejected", "isDefault": true}
    ]
  }'
```

---

## 工具 / MCP / Skills

### 注册工具

```bash
curl -X POST http://localhost:8080/api/tools \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "天气查询",
    "description": "查询指定城市的当前天气",
    "category": "utility",
    "parameters": "{\"type\":\"object\",\"properties\":{\"city\":{\"type\":\"string\"}}}"
  }'
```

### 绑定 MCP 服务

```bash
curl -X POST http://localhost:8080/api/mcps \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "文件系统 MCP",
    "type": "stdio",
    "command": "npx",
    "endpoint": "@modelcontextprotocol/server-filesystem"
  }'
```

---

## 错误处理

所有 API 错误遵循统一格式：

```json
{
  "errorCode": "RUN_404",
  "detail": "未找到该次讨论",
  "statusCode": 404
}
```

常见错误码：

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `AUTH_401` | 401 | 未认证或令牌过期 |
| `AUTH_403` | 403 | 权限不足 |
| `RUN_404` | 404 | 运行记录不存在 |
| `INVALID_400` | 400 | 请求参数校验失败 |
| `INTERNAL_500` | 500 | 服务器内部错误 |
