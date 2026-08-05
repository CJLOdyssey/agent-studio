# antd v5 → v6 迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 antd 从 `5.29.3` 升级到 `6.5.3`（当前最新），升级后与升级前**像素级一致**。只做依赖升级 + 必要适配，不做主题重构；修复 v6 带来的任何视觉回归，不引入新功能。

**Architecture:** 主题目前是「三套真相」：Tailwind `@theme` CSS 变量（tailwind-entry.css）+ ConfigProvider token（App.tsx 读 CSS 变量喂给 antd）+ ant-overrides.css 内部 DOM 覆盖（625 行、11 处 `!important`）。v6 默认启用 CSS 变量，可消除 token 桥接——但**本次迁移不重构主题**（重构单独立项），只保证 v6 下视觉与 v5 基线一致。

**Tech Stack:** React 18.3 + TypeScript + Tailwind CSS v4 + Vitest + Playwright/Chrome DevTools（视觉比对）

## Global Constraints

- **像素级比对**：升级前先截取全量视觉基线，升级后逐张比对，允许差异 = 0（除 antd 自身明确声明的行为变更，如 Tag 尾部 margin——逐项人工确认后接受或补回）
- 不改变任何组件 props 契约、不改业务逻辑、不删测试；测试只允许因 DOM 结构/文案变化而调整断言
- 所有现有测试必须通过：`npm test`（192 文件 2141 用例）+ `npm run build`（tsc -b && vite build）
- 每个 Task 完成后提交一次；提交时排除 repo 根三个 untracked 文件（`index.html`/`script.js`/`styles.css`）
- 不引入新依赖（视觉比对用现有浏览器工具/截图 + ImageMagick `compare`，如系统可用；不可用则人工逐张对照）
- 主题收敛（三套真相合一）不在本计划范围，另立任务
- 版本对齐：`@ant-design/icons@6.3.2` 已满足 v6 要求（>= 6.0.0），`@ant-design/cssinjs` 保留（StyleProvider 用于 layer，v6 兼容；zeroRuntime 优化不在范围）

## 现状盘点（迁移前已核实）

| 项 | 结论 |
|---|---|
| antd 版本 | `^5.29.3` → 目标 `6.5.3` |
| React | 18.3.0（v6 要求 >= 18 ✅） |
| @ant-design/icons | 6.3.2（v6 要求 >= 6.0.0 ✅） |
| v5-patch-for-react-19 | 不存在 ✅ |
| deprecated API 面 | grep 全空（destroyOnClose/bordered/bodyStyle/TabPane/overlayClassName 等均无） |
| antd 使用面 | 13 文件：Button/Modal/Dropdown/Select/Input/Upload/Tooltip/Empty/Pagination/Table/Space/Switch/Result/Tabs/Radio/Form/Collapse/Divider/Checkbox + message（仅 1 处 static `message.error`）+ theme/ConfigProvider/App |
| Form.List | 未使用（v6 onFinish 行为变化不涉及）✅ |
| 深路径 import | 1 处 type-only：`ApiProviderTab.tsx` 的 `import type { ColumnsType } from 'antd/es/table'` |
| 内部 DOM 覆盖 | ant-overrides.css 625 行（modal/table/btn/select/dropdown/pagination/checkbox/badge/empty/input）+ 11 处 `!important` —— v6 DOM 调整的**主要风险区** |
| StyleProvider | `App.tsx` `<StyleProvider layer={{ name: 'antd' }}>`；v6 release 6.5.3 已修 zeroRuntime+CSS layer 组合 bug（#58763） |
| 官方资料 | ✅ ant-design/ant-design `docs/react/migration-v6.en-US.md`（本次实测）；✅ GitHub release 6.5.3（2026-07-31）；✅ 前期调研发布公告 #55804 + 官方博客 |

**v6 关键变更（本项目相关摘录）**：
- DOM 结构调整：依赖内部节点选择器的自定义样式需检查调整（→ Task 4 核心工作）
- Modal/Drawer 新增 `mask` overlay 选项；6.0.0–6.2.x 默认 blur，6.3.0+ 默认不 blur（本项目 modal 覆盖深色背景，需确认无 blur 残留）
- Tag 默认尾部 margin 移除（`margin-inline-end`）—— 若布局依赖需 ConfigProvider 补回
- `size` 枚举统一 `large|medium|small`（`default`/`middle` 弃用）—— 本项目 Switch/Table 无 size prop，不受影响
- `Dropdown.dropdownRender` → `popupRender`、`Modal.destroyOnClose` → `destroyOnHidden` 等弃用 API 本项目均未用

---

### Task 1: 升级前视觉基线（v5）

**Files:**
- Create: `docs/superpowers/plans/visual-baseline-v5/`（截图存档目录）

**Interfaces:**
- Produces: 全量关键界面 × 浅色/深色截图基线，供 Task 5 逐张比对

- [ ] **Step 1: 启动混合模式环境**

```bash
docker compose -f docker/compose.local.yml up -d postgres redis
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/backend" make dev-backend
cd frontend && npm run dev   # http://localhost:5174
```

- [ ] **Step 2: 固定视口 1440×900，逐界面截图（浅色）**

固定视口保证与 Task 5 复截一致。界面清单（登录后导航）：

1. 主工作台（会话列表 + 空消息流）
2. 主工作台（发送一条消息后的消息流 + 输入区）
3. Team 管理表格（含 Pagination 尾部态、多选 Checkbox、行 hover）
4. MCP 管理表格
5. Skill 管理弹窗（含 Tab 切换、搜索框、Dropdown 展开态）
6. Prompt 管理弹窗
7. Agent 管理（新建按钮 Dropdown 展开态 + 表格）
8. Output 管理
9. API key 设置页（`api-key-table` 覆盖区）
10. Skill 表单弹窗（Input/Select 组合）
11. 登录弹窗
12. 会话切换后消息流（运行中切换场景）
13. 任意 Select 下拉展开态
14. 设置弹窗（主题切换开关）

截图存 `docs/superpowers/plans/visual-baseline-v5/light/<序号>-<名称>.png`

- [ ] **Step 3: 深色模式全量复截**

切换设置 → dark，重复 Step 2 清单，存 `docs/superpowers/plans/visual-baseline-v5/dark/`

- [ ] **Step 4: 记录基线测试/构建状态**

Run: `npm test`（预期 192 文件全绿）→ `npm run build`
Expected: 全绿；记录版本快照 `git rev-parse --short HEAD` 写入基线目录 README

- [ ] **Step 5: 提交基线**

`git add docs/superpowers/plans/visual-baseline-v5` → commit `chore: capture antd v5 visual baseline`

---

### Task 2: 依赖升级 antd@6 + 编译修复

**Files:**
- Modify: `frontend/package.json`、`frontend/package-lock.json`
- Modify（如编译报错）: `frontend/src/...` 相关引用

**Interfaces:**
- Produces: antd 6.5.3 依赖落地，`npm run build` 通过

- [ ] **Step 1: 升级依赖**

```bash
cd frontend && npm install antd@6
```

Expected: package.json 显示 `"antd": "^6.5.3"`（icons/cssinjs 不动，已满足）

- [ ] **Step 2: 构建，收集编译错误**

Run: `npm run build`
Expected: tsc 报错清单（v6 类型变更，预计很少——deprecated 面已 grep 为空；关注 `antd/es/table` type-only import 是否仍可用，否则改 `import type { TableProps }` + `TableProps<T>['columns']`）

- [ ] **Step 3: 逐一修复编译错误**

每处修复运行 `npm run build` 直到通过。规则：只改类型/API 适配，不动逻辑与样式。

- [ ] **Step 4: 全量测试**

Run: `npm test`
Expected: 全绿；若有失败先判定「v6 行为变更（接受并调断言）」还是「迁移引入回归（必须修复）」，逐一记录决策理由

- [ ] **Step 5: 浏览器冒烟（确认 antd 样式正常加载、StyleProvider layer 仍生效）**

打开 `http://localhost:5174`，确认：无 console 报错、无 antd 样式缺失、Modal/Dropdown 可正常打开。确认 `@ant-design/cssinjs` 无 v6 冲突 warning。

- [ ] **Step 6: 提交**

commit `feat: upgrade antd to v6.5.3`（若 Step 3 有代码修改一并纳入）

---

### Task 3: v6 API 行为核对（编译不报但语义变化项）

**Files:**
- Inspect: `frontend/src/components/AgentStudio/` 下 13 个 antd 引用文件

**Interfaces:**
- Produces: 逐项确认表（无行为差异项打勾）

- [ ] **Step 1: 核对 `mask` 与 modal 深色覆盖**

v6 Modal 新增 overlay mask 语义。用浏览器打开 Skill/Prompt 弹窗，确认 `.wsta-root` 深色背景覆盖正常、无 blur 残留（6.5.3 默认 blur off ✅，仅确认生效）。

- [ ] **Step 2: 核对 Tag 尾部 margin**

找 Tag 使用处（5 处引用文件），确认无依赖 `margin-inline-end` 的布局；如有 → ConfigProvider `tag.styles.root.marginInlineEnd: 8` 补回并记录。

- [ ] **Step 3: 核对 Dropdown/Select/Tooltip/Upload 行为**

Dropdown 展开态、Select 下拉、Upload 选择文件、Tooltip hover——浏览器逐个点验，对照基线截图确认无行为/视觉差异。

- [ ] **Step 4: 核对 message.error（唯一 static API 调用）**

触发一次导入失败场景，确认 toast 正常显示。

- [ ] **Step 5: 提交（如有代码修改）**

commit `fix: antd v6 API behavior adjustments`（无修改则跳过）

---

### Task 4: ant-overrides.css 内部 DOM 覆盖逐块验证（重灾区）

**Files:**
- Modify: `frontend/src/styles/workstation/ant-overrides.css`

**Interfaces:**
- Produces: 覆盖规则全部在 v6 DOM 下生效或按 v6 DOM 调整，11 处 `!important` 逐一复核是否仍需

- [ ] **Step 1: 浏览器逐组件核对（对照 Task 1 基线）**

按覆盖块清单逐块核对 v6 下是否仍生效：

1. `.ant-modal-*`（header/title/close/body/content/container）—— v6 Modal DOM 结构变化重点
2. `.ant-table-*`（容器/表头/单元格/hover/选中）—— v6 Table 结构变化重点
3. `.ant-btn-*`（default/primary/text）
4. `.ant-checkbox-*`
5. `.ant-pagination-*`（含快速跳转 input）
6. `.ant-select-*`（dropdown/selector/option）
7. `.ant-dropdown-*`（menu/item/divider）
8. `.ant-badge-*`、`.ant-empty-*`、`.ant-input-*`
9. 11 处 `!important`（含 `wsta-row-selected`、`api-key-table` 区）——逐处验证 v6 hashed 样式是否仍需要它压制；v6 默认 CSS 变量后可能不再需要，**移除即可的必须移除**（减轻 !important 债），需保留的补注释说明

- [ ] **Step 2: 修复失效覆盖**

对失效规则按 v6 新 DOM 结构改写（如 `.ant-modal-xxx` 结构变化），保持与基线截图视觉一致。

- [ ] **Step 3: 回归验证**

`npm test` + `npm run build` 全绿；浏览器复点 Step 1 全部块，确认与基线一致。

- [ ] **Step 4: 提交**

commit `fix: adapt ant-overrides.css to antd v6 DOM`

---

### Task 5: 像素级视觉回归比对（验收核心）

**Files:**
- Compare: `docs/superpowers/plans/visual-baseline-v5/` vs 升级后同机位截图

**Interfaces:**
- Produces: 差异清单（为空或全部人工接受）+ 修复

- [ ] **Step 1: 同机位复截（浅色）**

与 Task 1 Step 2 完全相同视口/界面清单，截 `docs/superpowers/plans/visual-v6/light/`

- [ ] **Step 2: 逐张像素比对**

```bash
compare -metric AE baseline.png v6.png diff.png   # ImageMagick，可用则用
```

不可用则浏览器 tab 并排人工核对。差异 > 0 的图判定：
- antd 自身声明变更（Tag margin 等）→ 人工接受并记录
- 其余任何差异 → 回 Task 3/4 修复，复截复比

- [ ] **Step 3: 深色模式复截复比**

与 Step 1/2 相同流程跑 dark 清单。

- [ ] **Step 4: 全量最终验证**

Run: `npm test` + `npm run build`
Expected: 全绿

- [ ] **Step 5: 提交**

commit `test: verify antd v6 visual parity`（含差异记录文档 `visual-v6/README.md`）

---

### Task 6: 收尾

**Files:**
- Modify: `AGENTS.md`（antd 版本记录，如有）

- [ ] **Step 1: 确认提交边界**

`git status`：确认 repo 根 `index.html`/`script.js`/`styles.css` 未入提交；查看 `git log --oneline` 确认 5 个 Task 提交齐全

- [ ] **Step 2: 与用户汇报**

汇报：升级结果、像素比对结论（差异清单 + 每项处理）、`!important` 增减数、遗留项（主题收敛待立项）

## Verification Strategy

- 每 Task 后门禁：`npm test`（全量）+ `npm run build` 必须全绿（Task 1 除外，Task 1 只建立基线）
- 浏览器验证走 chrome-devtools/playwright 工具，不用 read 链
- 验收标准 = Task 5 像素差异清单为空（或全部为「antd 官方声明变更，人工接受」）

## Risks

| 风险 | 概率 | 缓解 |
|---|---|---|
| ant-overrides.css 内部 DOM 覆盖失效（modal/table 结构变化） | 高 | Task 4 逐块核对 + Task 5 像素兜底 |
| 全局视觉微调（borderRadius/间距/字体）导致观感变化 | 中 | 像素比对逐张暴露，Task 4 用 CSS 变量覆盖对齐基线 |
| StyleProvider layer + v6 组合问题 | 低 | 6.5.3 已修 #58763；Task 2 Step 5 冒烟确认 |
| 深色模式 token 桥接（getCssVar）在 v6 CSS 变量默认化下行为变化 | 低 | 深色清单像素比对覆盖 |
| message static API 在 v6 的兼容 | 低 | 仅 1 处调用，Task 3 Step 4 验证 |
