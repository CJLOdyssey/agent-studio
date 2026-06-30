# 🤖 AgentStudio

> 基于 AI Agent 的AgentStudio协作系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)](https://www.python.org/)

---

## 📋 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [API 文档](#api-文档)
- [部署](#部署)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 🎯 项目简介

AgentStudio是一个基于 AI Agent 的智能协作系统，用户可以通过配置不同类型的 AI Agent 组建虚拟团队完成软件项目。

### 核心价值

- **智能协作**：多个 AI Agent 协同工作，模拟真实软件团队
- **灵活配置**：自定义 Agent 角色、提示词、工具、约束
- **可视化管理**：直观的工作台界面，轻松管理虚拟团队
- **企业级**：支持团队管理、权限控制、日志审计

---

## ✨ 功能特性

### 🤖 Agent 管理
- 创建和配置 AI Agent
- 自定义提示词和输出约束
- 绑定工具、MCP、Skills
- 版本管理和历史对比

### 📝 提示词管理
- 创建和编辑提示词
- 分类和标签管理
- 导入导出功能
- 版本历史追踪

### 📋 输出约束
- 定义输出格式约束
- 分类管理
- 复用和模板

### 🔧 工具管理
- 绑定和管理工具
- 配置工具参数

### 🌐 MCP 管理
- 配置 MCP 服务器
- 连接状态监控

### ⚡ Skills 管理
- 安装和管理 Skills
- 绑定到 Agent

### 👥 团队管理
- 创建团队分组
- 管理团队成员

### 📊 监控中心
- 实时监控 Agent 运行
- 性能指标展示

### 📜 日志审计
- 操作日志记录
- 审计追踪

### ⚙️ 系统设置
- 全局配置管理
- API 密钥管理

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| TypeScript | 5.6 | 类型系统 |
| Vite | 6.0 | 构建工具 |
| Tailwind CSS | 3.4 | 样式 |
| Zustand | 5.0 | 状态管理 |
| React Query | 5.100 | 数据获取 |
| React Router | 6.28 | 路由 |
| i18next | 26.3 | 国际化 |
| Lucide React | 1.17 | 图标 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.11 | 运行时 |
| FastAPI | 0.110 | Web 框架 |
| LangGraph | 0.2 | AI Agent 编排 |
| SQLAlchemy | 2.0 | ORM |
| PostgreSQL | 16 | 数据库 |
| Redis | 7.2 | 缓存 |

### 开发工具

| 工具 | 用途 |
|------|------|
| ESLint | 代码检查 |
| Prettier | 代码格式化 |
| Husky | Git hooks |
| Vitest | 单元测试 |
| Playwright | E2E 测试 |

---

## 🚀 快速开始

> 完整启动方式（本地开发 / Docker / CLI）见 **[QUICKSTART.md](QUICKSTART.md)**，以下仅列出最简步骤。

### 环境要求

- Node.js >= 18.0
- Python >= 3.11
- PostgreSQL >= 16
- Redis >= 7.2
- Docker（可选，用于 Docker 启动）

### 安装 & 配置

```bash
# 克隆项目
git clone https://github.com/your-org/virtual-team.git
cd virtual-team

# 前端依赖
cd frontend && npm install && cd ..

# 后端依赖
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 环境变量
cp .env.example .env && vim .env
```

### 启动

```bash
# 终端 1：前端
cd frontend && npm run dev       # → http://localhost:5173

# 终端 2：后端
PYTHONPATH=. python3 -m uvicorn virtual_team.app:app --reload  # → http://localhost:8080
```

或用 Docker 一键启动：

```bash
docker compose -f docker/compose.local.yml up -d  # 前端 :5173，后端 :8080
```

---

## 📁 项目结构

```
项目 7：AgentStudio/
├── AGENTS.md                    # 🗺️ AI 导航入口
├── CLAUDE.md                    # 🤖 AI 导航入口（同 AGENTS.md）
├── README.md                    # 📖 项目说明
├── QUICKSTART.md                # 🚀 快速启动指南（4 种方式）
├── CONTRIBUTING.md              # 📝 贡献指南
├── CHANGELOG.md                 # 📋 变更日志
├── frontend/                    # 🎨 React 前端
├── virtual_team/                # 🐍 Python 后端
├── docker/                      # 🐳 Docker 编排
│   ├── compose.local.yml        #   本地开发
│   ├── compose.prod.yml         #   生产部署
│   └── Dockerfile               #   后端镜像
├── docs/                        # 📚 文档
├── scripts/                     # 🔧 脚本
└── .github/workflows/           # 🤖 CI/CD
```

详细结构请查看 [docs/module-map.md](docs/module-map.md)

---

## 👨‍💻 开发指南

### 代码规范

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format

# 类型检查
npm run typecheck
```

### 测试

```bash
# 单元测试
npm run test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# E2E 测试
npx playwright test
```

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建/工具变更
```

### 分支规范

```
main          # 生产分支
├── develop   # 开发分支
├── feature/* # 功能分支
├── fix/*     # 修复分支
└── release/* # 发布分支
```

详细指南请查看 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📚 API 文档

启动后端后访问：

- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

### 主要 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | GET/POST | Agent 管理 |
| `/api/teams` | GET/POST | 团队管理 |
| `/api/sessions` | GET/POST | 会话管理 |
| `/api/runs` | POST | 运行 Agent |
| `/api/keys` | GET/POST | API 密钥管理 |

---

## 🚀 部署

### Docker 部署

```bash
# 本地开发环境（含 PostgreSQL / Redis）
docker compose -f docker/compose.local.yml up -d

# 生产环境（拉取远程镜像）
docker compose -f docker/compose.prod.yml up -d
```

所有服务的 Docker 编排文件在 `docker/` 目录下。

### 生产环境

生产环境通过 GitHub Actions 自动部署到阿里云 ECS：

```bash
# 手动触发部署
git push origin main  # 或 GitHub → Actions → Deploy → Run workflow
```

### 环境变量

完整环境变量见 `.env.example`，核心变量如下：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 | `postgresql+asyncpg://postgres@localhost:5432/virtual_team` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（LLM 响应必需） | - |
| `OPENAI_BASE_URL` | OpenAI 兼容 API 地址 | `https://api.deepseek.com` |
| `OPENAI_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `AUTH_MODE` | 认证模式（`legacy` / `rbac`） | `legacy` |
| `CORS_ORIGIN` | 跨域允许的源 | `http://localhost:5173` |
| `CHECKPOINTER_BACKEND` | 检查点存储后端 | `sqlite` |

---

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

### 贡献流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 📞 联系方式

- 项目主页: https://github.com/your-org/virtual-team
- 问题反馈: https://github.com/your-org/virtual-team/issues
- 邮件: dev@example.com

---

## 🙏 致谢

- [React](https://reactjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)

