# 虚拟软件外包团队 (Virtual Software Dev Team)

> 输入一个软件需求，三个 AI Agent（产品经理 / 资深程序员 / 测试工程师）自动讨论、输出文档、代码和审查意见。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 6 + Zustand 5 |
| 后端 | FastAPI |
| AI 框架 | AutoGen (pyautogen) GroupChat |
| 任务队列 | Celery + Redis |
| 数据库 | PostgreSQL 16 + SQLAlchemy async |
| 容器化 | Docker Compose (5 服务) |
| CI/CD | GitHub Actions → 自托管 Runner |

## 快速启动

### 前置条件

- Docker + Docker Compose
- 一个 LLM API Key（DeepSeek / OpenAI）

### 1. 配置环境变量

```bash
cp .env.template .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
```

### 2. 构建前端

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. 启动所有服务

```bash
docker compose up -d
```

访问 http://localhost:80

### 开发模式

```bash
# 后端（热重载）
uvicorn webapp:app --reload --port 8080

# 前端（Vite dev server）
cd frontend && npm run dev

# Celery Worker
celery -A virtual_team.celery_app worker --loglevel=info --concurrency=2
```

## 核心流程

1. 用户输入需求 → POST /api/runs（自动创建 Session）
2. Celery 异步执行 GroupChat 讨论（携带 Session 上下文中的历史记忆）
3. PM → 程序员 → 测试员 轮转发言（最多 MAX_ROUNDS 轮）
4. 测试员检测到关键词"【批准】" → 对话终止
5. 自动提取：PM 文档 / 代码 / 审查意见，并保存为结构化记忆
6. 结果通过 WebSocket 实时推送到前端

## 会话与长期记忆

同一需求的多次讨论通过 **Session（会话）** 组织在一起，Agent 可以访问历史讨论中提取的 **Memory（记忆）**，实现跨轮次上下文延续。

### Session（对话）

- 每次提交需求时自动创建或复用 Session
- 侧栏「对话」区域列出所有 Session，展开可看到该会话下的历史记录
- 点击历史记录进入详情页可继续输入需求延续对话

### Memory（记忆）

讨论完成后自动从中提取三类结构化记忆：

| 类型 | 来源 | 说明 |
|------|------|------|
| 📋 pm_document | PM Agent 文档 | 需求分析和设计方案 |
| 💻 code | 程序员 Agent 代码 | 代码实现要点和关键逻辑 |
| 🧪 review | 测试员 Agent 审查 | 发现的问题和修改建议 |

### 记忆管理

- **查看详情**：点击侧栏记忆条目展开完整详情
- **删除**：鼠标悬停记忆条目上的 🗑️ 按钮，删除单条记忆
- **导出**：点击记忆区域顶部的 JSON / MD 按钮，导出该 Session 的所有记忆
- **上下文注入**：同一 Session 下的后续讨论会参考已保存的记忆，实现连续对话

## 项目结构

```
webapp.py              # FastAPI 入口 + API 路由
virtual_team/          # 后端核心
├── agents.py          # AutoGen Agent 工厂
├── config.py          # 配置管理
├── conversation.py    # TeamManager (GroupChat 控制)
├── tasks.py           # Celery 任务定义
├── models.py          # Pydantic 数据模型
├── repository.py      # 数据库 CRUD
├── database.py        # SQLAlchemy 引擎 + ORM
├── extractors.py      # 文档/代码/评审提取
├── prompts.py         # 提示模板
└── agent_defaults.py  # 默认 Agent 配置
frontend/              # React SPA
tests/                 # 104 个单元测试
docker-compose.yml     # 5 服务编排
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| DEEPSEEK_API_KEY | — | DeepSeek API Key |
| OPENAI_BASE_URL | https://api.deepseek.com | LLM API 端点 |
| OPENAI_MODEL | deepseek-chat | 模型名称 |
| MAX_ROUNDS | 5 | 最大讨论轮数 |
| TEMPERATURE | 0.7 | 生成温度 |
| TIMEOUT | 120 | API 超时(秒) |
| MAX_RETRIES | 3 | 最大重试次数 |
| CORS_ORIGIN | — | 生产环境 CORS 来源 |
| LOG_LEVEL | INFO | 日志级别 |

## 文档

- [架构详解](docs/ARCHITECTURE.md) — 完整架构分析、数据流、API 参考
- [界面截图](docs/SCREENSHOTS.md) — 系统界面预览
- [已知问题](docs/KNOWN_ISSUES.md) — 当前已知问题与改进方向
