# 变更日志

本项目遵循 [语义化版本](https://semver.org/) 和 [Keep a Changelog](https://keepachangelog.com/) 格式。

---

## [未发布]

### 新增

- **可观测性系统**：EventStore (SQLite + 后台批量写入)、全链路 TraceContext (contextvars)、自诊断 health 端点
- **启动守卫**：进程启动前写 marker，异常崩溃可追溯
- **预检查脚本**：`scripts/preflight.py` — 启动前验证环境变量/数据库/Redis/磁盘/迁移状态
- **日志格式安全**：JsonFormatter 捕获 `%` 格式化异常，日志永不导致业务 500
- **请求体日志修复**：RequestLogMiddleware 不再提前消费请求体，POST/PUT/PATCH 正常解析

### 变更

- 恢复 18 个 `app.include_router()` 调用，修复全量 API 404
- `_init_database()` 改为 async，避免 `asyncio.run()` 在 lifespan 中抛异常
- 3 个 Alembic 迁移兼容 PostgreSQL 严格类型（boolean 字面量、条件 drop）
- 前端日志：axios 请求/响应拦截器、WebSocket 连接、Store 操作
- 后端日志：LLM 调用、Celery 任务、WebSocket、认证事件、限流事件

### 修复

- `request_logger.py` 格式字符串 8 个 `%s` 配 7 个参数 → 500 错误
- `skills.py` `author` 字段默认值 `None` → `""`，修复 NOT NULL 冲突
- CI 集成测试：添加 migration 步骤、显式 DATABASE_URL、preflight 检查
- 迁移 `d3e1f2a3b4c5`：checkpoints 表重命名改为条件执行
- 迁移 `e4f5a6b7c8d9`：PG boolean 字面量 `false` 替代整数 `0`

---

## [1.0.0] - 2026-06-22

### 新增

#### Agent 管理
- 创建和配置 AI Agent，自定义提示词和输出约束
- 绑定工具、MCP、Skills
- 版本管理和历史对比

#### 提示词管理
- 创建和编辑提示词，分类和标签管理
- 导入导出，版本历史追踪

#### 工具链
- 工具、MCP、Skills 的完整 CRUD
- 自定义安装和管理

#### 工作流引擎
- 可视化 DAG 编辑器（React Flow）
- 动态图执行（LangGraph），fan-out/fan-in 并行
- 实时思考链流式输出

#### 团队协作
- 团队分组管理
- 多 Agent 协同工作流

#### 用户认证
- JWT Token 鉴权 + RBAC 角色控制
- 注册/登录/密码重置完整流程

#### 前端
- React 18.3 + TypeScript 5.6 + Vite 6
- Tailwind CSS + Zustand + React Query
- i18next 国际化

#### 后端
- FastAPI + LangGraph + SQLAlchemy async
- PostgreSQL + Redis + Celery

---

## 版本说明

- **MAJOR**：不兼容的 API 变更
- **MINOR**：向下兼容的功能新增
- **PATCH**：向下兼容的问题修正
