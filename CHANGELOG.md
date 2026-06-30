# 📋 变更日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)，并使用 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

---

## [未发布]

### 新增
- 📋 项目导航系统 (CLAUDE.md)
- 📊 模块关联图 (docs/module-map.md)
- 📦 模块索引文件 (index.ts)
- 📖 项目 README.md
- 📝 贡献指南 CONTRIBUTING.md
- 📋 变更日志 CHANGELOG.md
- 🔧 文档检查脚本 (scripts/check-docs.js)
- 🔧 文档生成脚本 (scripts/generate-docs.js)
- 🚀 快速启动指南 QUICKSTART.md（4 种启动方式）

### 变更
- 🏗️ 优化项目结构文档
- 🔌 vite 代理目标端口统一：8081 → 8080（vite.config.ts, AGENTS.md）
- 🗑️ CORS 列表清理：移除了 8081 相关源（app.py）
- 📝 README.md 全面同步：修正启动命令、项目结构、部署方式、环境变量表、API 端口

### 修复
- 🔍 修复 AI Agent 无法快速定位模块文件的问题
- 🐳 docker/compose.local.yml 端口映射：5173:5173 → 5173:80
- 🐛 agent_graph.py 缺少 DEFAULT_TOOLS 列表 → 已补充（calculator / web_search / fetch_page）
- 🐛 main.py 调用不存在的方法 set_tools() → 改为 bind_tools()

---

## [1.0.0] - 2026-06-22

### 新增

#### 🤖 Agent 管理
- 创建和配置 AI Agent
- 自定义提示词和输出约束
- 绑定工具、MCP、Skills
- 版本管理和历史对比

#### 📝 提示词管理
- 创建和编辑提示词
- 分类和标签管理
- 导入导出功能
- 版本历史追踪

#### 📋 输出约束
- 定义输出格式约束
- 分类管理
- 复用和模板

#### 🔧 工具管理
- 绑定和管理工具
- 配置工具参数

#### 🌐 MCP 管理
- 配置 MCP 服务器
- 连接状态监控

#### ⚡ Skills 管理
- 安装和管理 Skills
- 绑定到 Agent

#### 👥 团队管理
- 创建团队分组
- 管理团队成员

#### 📊 监控中心
- 实时监控 Agent 运行
- 性能指标展示

#### 📜 日志审计
- 操作日志记录
- 审计追踪

#### ⚙️ 系统设置
- 全局配置管理
- API 密钥管理

#### 🎨 前端
- React 18.3 + TypeScript 5.6
- Vite 6.0 构建
- Tailwind CSS 样式
- Zustand 状态管理
- React Query 数据获取
- i18next 国际化
- Lucide React 图标

#### 🐍 后端
- FastAPI Web 框架
- LangGraph AI Agent 编排
- SQLAlchemy ORM
- PostgreSQL 数据库
- Redis 缓存

#### 🛠️ 开发工具
- ESLint 代码检查
- Prettier 代码格式化
- Husky Git hooks
- Vitest 单元测试
- Playwright E2E 测试

---

## 版本说明

### 语义化版本

- **主版本号 (MAJOR)**：不兼容的 API 变更
- **次版本号 (MINOR)**：向下兼容的功能性新增
- **修订号 (PATCH)**：向下兼容的问题修正

### 版本号规则

- 1.0.0 之前的所有版本均为开发版本
- 1.0.0 为首个稳定版本
- 每个版本都会在此文件中记录变更

---

## 维护者

- 项目维护团队

---

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。
