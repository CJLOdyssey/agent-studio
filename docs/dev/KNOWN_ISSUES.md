# 已知问题与改进方向

> 按优先级排列。🟢 可快速修复，🔴 阻塞生产部署。

---

## 🔴 P0 — 阻塞级

### ~~1. Dockerfile 未包含前端构建产物~~ ✅ 已解决

**状态：** Dockerfile 已改为 multi-stage build，包含前端构建产物。

---

### ~~2. CI Deploy 步骤缺少 ghcr.io 登录~~ ✅ 已解决

**状态：** 已迁移至 ACR，不再使用 GHCR。此问题不再适用。

---

### 3. Nginx 和 API 之间缺少 depends_on

**问题：** `docker-compose.yml` 中 `frontend` 的 `depends_on` 只是 `api`，但不等待 API 健康检查通过。

**影响：** Nginx 可能在 API 还未就绪时就开始接受请求，导致 502 Bad Gateway。

**建议：** 使用 `depends_on: api: condition: service_healthy`（需要先给 api 加上 healthcheck label）

---

## 🟡 P1 — 高优先级

### 4. .env 文件未在 CI 中管理

**问题：** CI 流水线中没有创建/注入 `.env` 文件，而 `docker compose` 依赖 `.env` 读取 `DEEPSEEK_API_KEY` 等变量。

**影响：** CI 部署后服务缺少 API Key，讨论功能不可用。

**建议：** 使用 GitHub Secrets 管理 `.env` 内容，在 deploy 步骤之前写入：`echo "${{ secrets.ENV_FILE }}" > .env`

---

### 5. seed_default_agents() 在 lifespan 中执行

**问题：** `webapp.py` lifespan 启动时执行 `seed_default_agents()`，依赖数据库可用。如果数据库未就绪就跳过。

**影响：** 首次部署可能导致 Agent 配置未播种，需要手动触发或重启。

**建议：** 使用重试机制（指数退避）或在首次 API 请求时延迟播种。

---

### 6. 缺少 e2e / 集成测试

**问题：** 目前 104 个测试全部是纯单元测试（mock DB / mock AutoGen）：

| 缺失 | 影响 |
|------|------|
| FastAPI TestClient 集成测试 | API 路由变更无法自动验证 |
| WebSocket 测试 | 实时流推送可能无声损坏 |
| Repository DB 集成测试 | ORM 变更可能导致查询错误 |
| Celery 任务单元测试 | 任务逻辑变更无防护 |

**建议：**
- 使用 `httpx.AsyncClient` + FastAPI TestClient 测试 API 路由
- 使用 test PostgreSQL 容器测试 repository 层
- 为 Celery task 添加 mock 测试

---

## 🟢 P2 — 低优先级

### 7. 残留依赖 antd

**问题：** `frontend/package.json` 仍依赖 `antd ^5.22.0`，但前端 UI 已是纯 CSS（DeepSeek 暗色主题），未使用 antd。

**建议：** 移除 `antd` 依赖，减少构建体积。

---

### 8. 残留旧入口文件

**问题：** `streamlit_app.py` 是项目早期的 Streamlit 入口，现已由 FastAPI + React 替代。

**建议：** 确认无引用后删除。

---

## 改进方向（功能层面）

### Agent 投票审批机制

当前由 tester 一人通过 `APPROVAL_KEYWORD` 决定是否批准。可以改为：
- 所有 Agent 投票表决
- 需要半数或全员通过
- 计票逻辑可配置

### Agent 配置的版本化管理

当前 `agent_configs` 表直接覆盖更新。可以改为：
- 每次编辑创建新版本（非破坏性更新）
- 运行时可指定使用哪个版本
- 支持回滚

### 前端 Agent 可视化编排

当前 Agent 顺序由 `order` 字段决定。可以改为：
- 拖拽式流水线编排
- 可视化配置讨论流
- 动态插入/移除 Agent
