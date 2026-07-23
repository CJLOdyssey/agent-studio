# 贡献指南

感谢你对 AgentStudio 的关注。本文档说明如何参与项目开发。

> **注意**：详细安装和启动步骤见 [QUICKSTART.md](QUICKSTART.md)，项目架构见 [AGENTS.md](AGENTS.md)。

## 贡献方式

- **代码**：修复 bug、添加功能、优化性能
- **文档**：改进文档、添加示例
- **测试**：添加测试用例、报告 bug
- **设计**：改进 UI/UX

## 开发流程

```text
Fork → 创建分支 → 开发 → 测试 → 提交 → Push → Pull Request → Review → Merge
```

### 提交信息

提交信息遵循 `.gitmessage` 模板（项目根目录），格式为 `<type>: <简短描述>`。

```text
feat:    新功能          fix:     修复 Bug
docs:    文档变更        test:    测试相关
refactor:重构            chore:   构建/工具链
perf:    性能优化        security:安全修复
```

启用模板：`git config commit.template .gitmessage`

### 分支命名

```text
feat/xxx    # 新功能
fix/xxx     # Bug 修复
docs/xxx    # 文档变更
refactor/xxx # 重构
test/xxx    # 测试
chore/xxx   # 构建/工具
```

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```text
<type>(<scope>): <description>

# 示例
feat(agents): add agent version diff view
fix(auth): handle expired token refresh race condition
docs(readme): update quick start instructions
```

### 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/工具 |
| `ci` | CI/CD |

## Pull Request 流程

1. **创建 PR 前**
   - 确保所有测试通过：`npm test`（前端） + `pytest`（后端）
   - 确保 lint 通过：`npm run lint` + `ruff check`
   - 确保类型检查通过：`npm run typecheck` + `mypy`

2. **PR 描述**
   - 说明改动的目的和背景
   - 列出主要变更点
   - 关联相关 Issue（如有）

3. **Review 流程**
   - 至少需要 1 人 Approve
   - Review 通过后由作者合并

## 代码规范

### 前端

- TypeScript `strict: true`，禁止 `as any` / `@ts-ignore`
- React 函数组件 + Hooks
- Zustand 管理全局状态，TanStack Query 管理服务端状态
- CSS 使用 `wsta-*` 前缀，避免 CSS Modules
- 每个 CRUD 模块遵循 9-10 文件结构

### 后端

- 三层架构：`database.py` → `repository/` → `routers/`
- 异步优先：async/await + asyncpg
- Ruff + Mypy strict 检查
- 新增模块需在 `pyproject.toml` 添加 mypy 忽略规则

## 问题报告

提交 Issue 时请包含：

- 环境信息（OS、Python 版本、Node 版本）
- 复现步骤
- 期望行为与实际行为
- 相关日志（可附带 /api/debug/trace/{id} 追踪 ID）
