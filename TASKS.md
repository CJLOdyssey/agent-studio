# 100% 优化清单

> 基于代码库真实缺陷的完整清单。来源：四轮评估 + 评委终审。
> 状态：✅ 已完成 | ⏳ 进行中 | ❌ 未开始

---

## 一、架构（当前 88 → 100，差 12 分）

### 1.1 消除所有 ORM 直连

| # | 位置 | 问题 | 修复方式 | 状态 |
|---|------|------|---------|------|
| 1 | `backend/repository/admin_stats.py` | 可能直连 ORM | ✅ 已仓库化（继承标准 repository 模式） | ✅ |
| 2 | `backend/core/infra/database.py:init_db()` | 直接创建所有表和种子数据 | 抽取种子逻辑到独立 seeder | ❌ |
| 3 | `backend/core/app.py` health check | 直连 `get_session_factory()` | ✅ 移至 `repository/health.py` | ✅ |

### 1.2 模块约定统一

| # | 位置 | 问题 | 修复方式 | 状态 |
|---|------|------|---------|------|
| 4 | `frontend/.../workstation/logs/` | 检查是否遵循 9-10 文件约定 | ✅ display-only 模块，无需 CRUD 模板 | ✅ |
| 5 | `frontend/.../workstation/monitor/` | 同上 | ✅ display-only 模块，无需 CRUD 模板 | ✅ |
| 6 | `frontend/.../modals/AgentConfigModal.tsx` | ~350 行 → 210行，props/CRUD提取 | ✅ useConfigItemEdit + useAgentConfigForm 已拆分 |
| 7 | `frontend/.../TabRenderer.tsx` | ~250 行，switch-case 渲染 5 个子 Tab | ✅ renderItemTab<T> 泛型函数，251→150行 |

---

## 二、代码质量（当前 88 → 100，差 12 分）

### 2.1 消除全部 as unknown as X（生产代码 15 处）

| # | 文件 | 行 | 当前写法 | 修复方式 | 状态 |
|---|------|----|---------|---------|------|
| 8 | `TabRenderer.tsx` | 107 | `editingToolItem as unknown as Record<string, unknown>` | ✅ `toRecord()` 助手 | ✅ |
| 9 | `TabRenderer.tsx` | 153 | `editingMcpItem as unknown as Record<string, unknown>` | ✅ 同上 | ✅ |
| 10 | `TabRenderer.tsx` | 165 | `form.forms.mcp.data as unknown as Parameters<...>` | ✅ `as MCPFormData` | ✅ |
| 11 | `TabRenderer.tsx` | 201 | `editingSkillItem as unknown as Record<string, unknown>` | ✅ `toRecord()` 助手 | ✅ |
| 12 | `TabRenderer.tsx` | 213 | `form.forms.skill.data as unknown as Parameters<...>` | ✅ `as SkillFormData` | ✅ |
| 13 | `SkillsTab.tsx` | 38 | `editingItem as unknown as SkillEntry` | ✅ 导入 SkillEntry 类型 | ✅ |
| 14 | `MCPTab.tsx` | 38 | `editingItem as unknown as MCPEntry` | ✅ 导入 MCPEntry 类型 | ✅ |
| 15 | `AgentConfigModal.tsx` | 101 | `(item as unknown as Record<string, string>).parameters` | ✅ `String()` + 单层 as | ✅ |
| 16 | `AgentConfigModal.tsx` | 181 | `item as unknown as AgentTool` | ✅ `toRec<AgentTool>()` | ✅ |
| 17 | `AgentConfigModal.tsx` | 187 | `item as unknown as AgentMCP` | ✅ `toRec<AgentMCP>()` | ✅ |
| 18 | `AgentConfigModal.tsx` | 201 | `item as unknown as AgentSkill` | ✅ `toRec<AgentSkill>()` | ✅ |
| 19 | `useWorkstationState.ts` | 138 | `m as unknown as Record<string, string>` | ✅ `Reflect.get()` | ✅ |
| 20 | `useWorkstationState.ts` | 139 | `m as unknown as Record<string, string>` | ✅ 同上 | ✅ |
| 21 | `hooks/useTeamData.ts` | 28 | `a as unknown as Record<string, unknown>` | ✅ `Reflect.get()` | ✅ |
| 22 | `resultHandler.ts` | 93 | `RunResult` 硬构造 | ✅ 工厂函数 `makeRunResult()` | ✅ |

### 2.2 消除全部 # type: ignore

| # | 文件 | 行数 | 原因 | 修复方式 | 状态 |
|---|------|------|------|---------|------|
| — | `routers/sessions.py` | 7 → 0 | `request` 移至首参 + `-> Any` 返回注解 | ✅ 全部清零 |
| 24 | `redis_sentinel.py` | 2 处 | `Sentinel()` 和 `master_for()` 无类型 | 第三方库 stub 缺失，保留 | ❌ |
| 25 | `broker/__init__.py` | 1 处 | `Celery import-untyped` | types-celery 不存在，保留 | ❌ |
| 26 | `core/app.py` | 3 处 | `sentry_sdk import-not-found` | sentry 可选依赖，保留 | ❌ |
| — | `repository/teams.py` | 1 处 | ~~`return-value`~~ | ✅ 已用 `cast()` 替代 | ✅ |
| — | `repository/prompts.py` | 1 处 | ~~`return-value`~~ | ✅ 已用 `cast()` 替代 | ✅ |

### 2.3 收紧 TS 严格模式

| # | 项目 | 状态 |
|---|------|------|
| 27 | 确认 `tsconfig.json` 中 `strict: true` 对所有文件生效 | ✅ 已存在 |
| 28 | 在新代码门禁中加入 `no-explicit-any` ESLint 规则 | ✅ 已存在 |
| 29 | 补齐 backend mypy --strict 剩余 type:ignore（13→0） | ❌ |

---

## 三、测试成熟度（当前 85 → 100，差 15 分）

### 3.1 修复失败的测试

| # | 文件 | 问题 | 状态 |
|---|------|------|------|
| — | `di-setters.test.ts` | ~~5 个 toBe() 引用检查~~ | ✅ |
| — | `useOutputData.test.ts` | ~~3 个 mock 策略不兼容~~ | ✅ |
| — | `agent/api.test.ts:138` | ~~`toBe(mockAPI)`~~ | ✅ |
| — | `test_auth_rbac.py` | ~~5 个 session.execute → session.get~~ | ✅ |
| — | `test_audit.py` | ~~2 个 patch 目标过时~~ | ✅ |
| 30 | 确认全部 test 文件与 renamed 后的模块名一致 | ✅ |
| 31 | 运行 `npm test` + `pytest` 确认零失败 | ⚠️ 前端 373/373 ✅ 后端 1921/1926（5 预存失败） |

### 3.2 补齐缺失测试

| # | 目标 | 最低要求 | 状态 |
|---|------|---------|------|
| — | `api-base.test.ts` | defineCrudModule 12 测试 | ✅ |
| — | `test_rate_limit.py` | RateLimiter 10 测试 | ✅ |
| 32 | `useGenericCrud.ts` | 每个公开方法 × happy + error path（~20 测试） | ❌ |
| 33 | `SecurityHeadersMiddleware` | 验证三个头全部注入 + env override | ❌ |
| 34 | `repository/*.py` | 每个 repository 一个 CRUD 测试 | ❌ |
| 35 | `auth_rbac.py` | `require_role()` 权限拒绝逻辑 | ❌ |
| 36 | `backend/routers/` 现有测试覆盖率 | 检查当前行覆盖率并补齐 | ❌ |

### 3.3 覆盖率提升到目标

| # | 阈值 | 当前 | 目标 | 状态 |
|---|------|------|------|------|
| 37 | frontend statements | 75% | 90% | ❌ |
| 38 | frontend branches | 65% | 85% | ❌ |
| 39 | frontend functions | 60% | 85% | ❌ |
| 40 | frontend lines | 75% | 90% | ❌ |
| 41 | backend 总覆盖率 | ~? | 85% | ❌ |

### 3.4 E2E 测试

| # | 项目 | 状态 |
|---|------|------|
| 42 | 核心流（创建 Agent → 运行对话 → 查看结果） | ❌ |
| 43 | RBAC 认证 E2E | ❌ |
| 44 | MCP 工具调用 E2E | ❌ |
| 45 | WebSocket 流式推送 E2E | ❌ |

---

## 四、CI/CD（当前 89 → 100，差 11 分）

| # | 项目 | 状态 |
|---|------|------|
| — | 3 workflow Python 3.11 → 3.12 | ✅ |
| — | size-limit 配置 | ✅ `npm run size` |
| 46 | 在 CI 中加入 bundle size 监控 | ⚠️ 已配置，需构建通过后生效 |
| 47 | 在 CI 中加入 diff-cover PR 门禁 | ⚠️ 已存在，确认生效 |
| 48 | 在 CI 中加入 mypy --strict 门禁（新房号制） | ✅ 已存在：ci.yml:178 |
| 49 | 用 deptry 检测未使用的依赖 | ❌ 系统限制 |
| 50 | 在 CI 中加入后端性能回归测试 | ❌ |

---

## 五、安全（当前 92 → 100，差 8 分）

| # | 项目 | 状态 |
|---|------|------|
| — | `SecurityHeadersMiddleware`（X-Content-Type-Options / X-Frame-Options / HSTS） | ✅ |
| 51 | 请求体大小限制中间件 | ✅ `RequestSizeLimitMiddleware` |
| 52 | 全局异常日志脱敏（`exc_info=True` 可能泄露请求体） | ⚠️ 已审计：仅 log method+path+exc，不包含请求体。低风险保持现状 |
| 53 | RateLimitMiddleware 单测 | ✅ 10 tests |
| 54 | CSP 策略加固（评估是否需要更严格） | ⚠️ 已审计：`default-src 'self'` 对 API 后端已足够 |
| 55 | 检查所有 user_id / X-User-ID 是否被记录到日志（PII 泄露风险） | ⚠️ 已审计：rate_limit.py 记录 user_id，但格式为 UUID（低 PII 风险） |
| 56 | 在 `.env.example` 中标注安全变量生产建议值 | ✅ |
| 57 | 检查前端 API client 中的 token 存储方式（localStorage → XSS 可窃取） | ✅ httpOnly cookie（access_token）+ localStorage（refresh_token） |
| 58 | 检查 refresh token 轮换策略 | ✅ 已实现：family_id 轮换 + replay 检测 + 全族吊销 |

---

## 六、文档（当前 81 → 100，差 19 分）

| # | 项目 | 状态 |
|---|------|------|
| 59 | AGENTS.md 模块数量与实际代码同步 | ❌ |
| 60 | 补齐缺少的模块 locales.ts 翻译键值 | ❌ |
| 61 | ADR 文档覆盖团队（DynamicTeamGraph 的重要决策） | ❌ |
| 62 | API 文档整理（缺少使用示例） | ❌ |
| 63 | README 更新：添加更多架构图 | ❌ |
| 64 | 建立 CHANGELOG / Release Notes 流程 | ❌ |
| 65 | 建立文档与代码同步的自动化检查 | ❌ |

---

## 七、性能（当前 78 → 100，差 22 分）

| # | 项目 | 状态 |
|---|------|------|
| 66 | 前端 bundle 分析 + size-limit 配置 | ⚠️ 已配置，需构建通过 |
| 67 | 检查重复依赖（depcheck / knip） | ❌ |
| 68 | 前端懒加载：WorkstationPage 10 个 tab code splitting | ❌ |
| 69 | 后端主要查询 EXPLAIN ANALYZE + 索引优化 | ❌ |
| 70 | 建立后端性能基准测试（locust / k6） | ❌ |
| 71 | WebSocket 消息积压测试（1000+ 并发） | ❌ |
| 72 | Redis 连接池调优 | ❌ |
| 73 | 数据库连接池调优（get_session_factory() 是否复用连接池？） | ❌ |
| 74 | 前端 render 性能分析（React DevTools Profiler） | ❌ |
| 75 | 大列表虚拟化（1000+ 条场景） | ❌ |

---

## 八、补充项

| # | 项目 | 状态 |
|---|------|------|
| 76 | `useWorkstationState.ts` MCP/skill 字段类型含 `@ts-ignore` 级别问题 | ❌ |
| 77 | 检查 `mappers.ts` 中的 `JSON.parse` 是否安全处理非法字符串 | ✅ 已有 try/catch 保护 |
| 78 | 检查所有 `vi.mock()` 模块是否在重命名后同步更新 | ✅ 无存量问题 |
| 79 | 确认 defineCrudModule Proxy 对所有 7 个 CRUD 模块生效 | ✅ |
| 80 | 确认 `useOutputManagement.test.ts` 在 CI 中通过 | ✅ |

---

## 汇总

| 维度 | 当前 | 100% | 已执行 |
|------|------|------|--------|
| 架构 | 88 | 100 | 2/7 项 |
| 代码质量 | 88 | 100 | 3/22 项 |
| 测试成熟度 | 85 | 100 | 6/16 项 |
| CI/CD | 89 | 100 | 2/5 项 |
| 安全 | 92 | 100 | 5/8 项 |
| 文档 | 81 | 100 | 0/7 项 |
| 性能 | 78 | 100 | 0/10 项 |
| **加权总分** | **~86** | **100** | **已完成 ~20 项** |

> 估值：剩余 ~60 项约需 80 人天。
