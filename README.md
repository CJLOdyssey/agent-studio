# 🤖 虚拟软件外包团队

> 基于 AI Agent 的虚拟软件外包团队协作系统

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

虚拟软件外包团队是一个基于 AI Agent 的智能协作系统，用户可以通过配置不同类型的 AI Agent 组建虚拟团队完成软件项目。

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

### 环境要求

- Node.js >= 18.0
- Python >= 3.11
- PostgreSQL >= 16
- Redis >= 7.2

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/virtual-team.git
cd virtual-team

# 安装前端依赖
cd frontend
npm install

# 安装后端依赖
cd ..
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

### 启动

```bash
# 启动前端
cd frontend
npm run dev

# 启动后端
cd ..
python -m virtual_team.main
```

访问 http://localhost:5173

---

## 📁 项目结构

```
项目 7：虚拟软件外包团队/
├── CLAUDE.md                    # 🗺️ AI 导航入口
├── README.md                    # 📖 项目说明
├── CONTRIBUTING.md              # 📝 贡献指南
├── CHANGELOG.md                 # 📋 变更日志
├── frontend/                    # 🎨 React 前端
│   ├── src/
│   │   ├── components/
│   │   │   └── devagents/       # Agent 管理组件
│   │   ├── hooks/
│   │   ├── types/
│   │   └── styles/
│   ├── package.json
│   └── tsconfig.json
├── virtual_team/                # 🐍 Python 后端
│   ├── app.py                   # FastAPI 入口
│   ├── main.py                  # 启动入口
│   ├── models.py                # 数据模型
│   ├── routers/                 # API 路由
│   ├── repository/              # 数据访问层
│   └── system_team/             # 系统团队配置
├── docs/                        # 📚 文档
│   ├── architecture.md          # 架构说明
│   ├── modules.md               # 模块说明
│   └── superpowers/specs/       # 设计规范
├── scripts/                     # 🔧 脚本
│   ├── check-docs.js            # 文档检查
│   └── generate-docs.js         # 文档生成
├── .github/                     # GitHub 配置
│   └── workflows/
│       └── ci.yml               # CI 流程
├── docker-compose.yml           # Docker 编排
├── Dockerfile                   # Docker 镜像
└── requirements.txt             # Python 依赖
```

详细结构请查看 [docs/modules.md](docs/modules.md)

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

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

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
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 生产环境

```bash
# 前端构建
cd frontend
npm run build

# 后端部署
gunicorn virtual_team.app:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | 数据库连接 | `postgresql://localhost/virtual_team` |
| `REDIS_URL` | Redis 连接 | `redis://localhost:6379` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `SECRET_KEY` | JWT 密钥 | - |

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
# SERVER_PASSWORD configured
