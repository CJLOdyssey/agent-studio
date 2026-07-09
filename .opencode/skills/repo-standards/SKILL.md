---
name: repo-standards
description: Repository standards for what files should/shouldn't be committed. Consult before adding, deleting, or ignoring any file in the repo.
---

# 仓库提交规范

## 必须提交

| 类别 | 内容 | 原因 |
|------|------|------|
| 源代码 | `frontend/`, `virtual_team/`, `scripts/`, `docker/`, `docs/` | 项目核心代码 |
| 配置文件 | `pyproject.toml`, `alembic.ini`, `.env.example`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/eslint.config.js` | 构建/运行配置，全员共享 |
| CI/CD | `.github/workflows/` | 自动化流水线 |
| 项目文档 | `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `QUICKSTART.md`, `AGENTS.md`, `CLAUDE.md` | 项目知识库 |
| 数据库迁移 | `alembic/versions/` | 版本化 schema 变更 |
| AI 工具链 | `.opencode/`（不含 `skills/` 所有 skill 目录）、`CLAUDE.md`、`AGENTS.md` | 开发工具配置（团队共享） |

## 按需决定（看团队约定）

| 类别 | 建议 | 说明 |
|------|------|------|
| AI Skills（技能） | **不提交**，仅保留 `skills-lock.json` | Skills 是个人开发辅助，团队各人偏好不同。安装方式：clone 后 `npx skills install` |
| `.opencode/skills/*/` | ❌ 不提交 | 通过 `skills-lock.json` 管理 |
| `.agents/skills/*/` | ❌ 不提交 | 同上 |

## 禁止提交

| 类别 | 内容 | 原因 |
|------|------|------|
| 环境变量 | `.env`, `.env.local`, `.env.*.local` | 凭据泄露风险 |
| IDE 配置 | `.idea/`, `.vscode/`, `*.swp`, `*.swo`, `*~`, `.obsidian/` | 个人偏好，不共享 |
| 操作系统文件 | `.DS_Store`, `Thumbs.db`, `desktop.ini` | 系统生成，无意义 |
| 依赖目录 | `node_modules/`, `.venv/` | 体积大，可重建 |
| 缓存 | `__pycache__/`, `.mypy_cache/`, `.pytest_cache/`, `.ruff_cache/`, `.playwright-mcp/` | 可自动生成 |
| 构建产物 | `dist/`, `*.egg-info/`, `*.whl`, `htmlcov/`, `coverage.xml` | 可重建 |
| 数据库文件 | `*.db`, `*.db-shm`, `*.db-wal`, `.sqlite3` | 本地数据 |
| 日志文件 | `*.log`, `*.log.*` | 运行时产生 |
| 本地工具 | `.sisyphus/`, `prototypes/`, `uploads/` | 开发过程产物 |
| 部署脚本 | `scripts/deploy_prod.py`, `scripts/ask_credentials.py` | 含敏感信息 |
| Docker 缓存 | `.docker/` | 构建缓存 |

## 当前项目技能清单

以下 skill 目录已安装，按规范不应提交到仓库（仅 `skills-lock.json` 应被追踪）：

```
.opencode/skills/
├── ai-slop-remover          # 移除 AI 代码异味
├── brainstorming            # 需求分析
├── brandkit                 # 品牌设计
├── brutalist-skill          # 粗野主义 UI
├── customize-opencode       # OpenCode 配置
├── design-consistency-auditor # 设计一致性审查
├── design-taste-frontend    # 前端设计品味 (v2)
├── taste-skill              # 前端设计品味 (v1 旧版)
├── taste-skill-v1           # 前端设计品味 (v1 保留版)
├── dispatching-parallel-agents # 并行代理分发
├── enterprise-mindset       # 企业级代码标准
├── executing-plans          # 执行计划
├── file-organizer           # 文件整理
├── find-skills              # 查找技能
├── finishing-a-development-branch # 分支收尾
├── frontend-design          # 前端设计
├── gpt-tasteskill           # GPT 品味
├── image-to-code-skill      # 图片转代码
├── imagegen-frontend-mobile # 移动端图片生成
├── imagegen-frontend-web    # Web 端图片生成
├── import-checker           # 导入检查
├── minimalist-skill         # 极简 UI
├── neat-freak               # 会话总结
├── oh-my-opencode           # OpenCode 编排
├── output-skill             # 输出强制
├── receiving-code-review    # 接收代码审查
├── redesign-skill           # 重设计
├── refactor                 # 重构
├── requesting-code-review   # 请求代码审查
├── soft-skill               # 高端视觉设计
├── stitch-skill             # Google Stitch 设计系统
├── subagent-driven-development # 子代理开发
├── systematic-debugging     # 系统化调试
├── tailwind-design-system   # Tailwind 设计系统（待删除）
├── test-driven-development  # TDD
├── using-git-worktrees      # Git Worktree
├── using-superpowers        # 超能力使用
├── vercel-react-best-practices # Vercel React 最佳实践
├── verification-before-completion # 完成前验证
├── verification-loop        # 验证循环
├── webapp-testing           # WebApp 测试
├── writing-plans            # 写计划
└── writing-skills           # 写技能
```

## 推荐的 skill 管理策略

```bash
# 安装技能（生成 skills-lock.json）
npx skills add <owner/repo@skill>

# 新成员克隆后安装所有技能
npx skills install

# 只提交 lock 文件，不提交 skill 目录
git add skills-lock.json
# ❌ 不提交 .opencode/skills/*/ 或 .agents/skills/*/
```

## 变更 checklist

修改代码时检查以下文件是否需要同步更新：

- [ ] `AGENTS.md` — routers/repository/models 计数
- [ ] `CLAUDE.md` — workstation 模块数
- [ ] `.env.example` — 新增环境变量
- [ ] `README.md` — 功能/架构变更
