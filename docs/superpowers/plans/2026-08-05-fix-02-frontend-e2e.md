# Fix 02: 前端 E2E CI 调用已删除文件修复 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p2 main -b fix/p2-frontend-e2e`）。只修改本文件列出的文件。

**Goal:** `frontend-e2e` 与每日 `e2e-smoke` 改跑 Playwright spec，替换已删除的 `smoke_tests.py`。
**Architecture:** playwright.config.ts 的 baseURL 改为环境变量可覆盖；两个 workflow 的 smoke 步骤改为 `npx playwright test`。
**Tech Stack:** Playwright / GitHub Actions

## 并行协调

- 独占文件：`frontend/playwright.config.ts`、`.github/workflows/ci.yml`（frontend-e2e job，~L514-537）、`.github/workflows/e2e-smoke.yml`
- ci.yml 共享：编辑 frontend-e2e job 区域，与 P1(L400)/P8(L449)/P6(L183-195/L725) 不重叠；**merge 顺序 P1→P8→P2→P6**

## Global Constraints

- 不修改其它方案的独占文件
- 提交遵循 .gitmessage 格式

---

## 根因

commit `b623e0c` 用 Playwright spec 替换了 `frontend/e2e/smoke_tests.py`，但 `ci.yml:537` 与 `e2e-smoke.yml:64` 仍执行该文件 → 两个 job 必然失败；且 playwright.config.ts baseURL 固定 5174 与 CI 的 5173 不一致，Playwright spec 与 CI 失联。

## Files

- Modify: `frontend/playwright.config.ts:10`
- Modify: `.github/workflows/ci.yml`（frontend-e2e job，~L514-537）
- Modify: `.github/workflows/e2e-smoke.yml`（~L42-64）

---

- [ ] **Step 1: playwright.config.ts baseURL 环境可覆盖**

```ts
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
```

- [ ] **Step 2: ci.yml frontend-e2e job 替换 smoke 步骤**

将浏览器安装步骤（~L514-515）改为 npm playwright 浏览器安装：

```yaml
      - run: npx playwright install chromium --with-deps
        working-directory: frontend
```

将 "Run smoke tests" 步骤（~L536-537）替换为：

```yaml
      - name: Run Playwright E2E smoke tests
        working-directory: frontend
        run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test --project=chromium
```

- [ ] **Step 3: e2e-smoke.yml 同步替换**

```yaml
      - name: Run Playwright E2E smoke tests
        working-directory: frontend
        run: PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test --project=chromium
```

- [ ] **Step 4: 本地验证**

```bash
cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test --project=chromium 2>&1 | tail -10
# 期望：agent.spec.ts / team.spec.ts 通过（需后端 8080 已起）
```

> ⚠️ **风险**：`team.spec.ts` 含 `RUN_FROM` 手动跳过与 `clearOverlays` 暴力删 DOM（反模式），且 auth.setup.ts 的登录流程面向 RBAC 模式；CI 以 `AUTH_MODE=legacy` 起后端。Step 4 本地验证必须覆盖 legacy 模式，若 spec 依赖 RBAC 登录则需调整 spec 或 CI 用 rbac 模式，否则 CI 会红。此风险在 CI 合并前必须消除。

- [ ] **Step 5: Commit**

```bash
git add frontend/playwright.config.ts .github/workflows/ci.yml .github/workflows/e2e-smoke.yml
git commit -m "fix(ci): run Playwright specs instead of deleted smoke_tests.py"
```

## Self-Review

- 本地 `npm run test:e2e:run` 默认 baseURL 仍为 5174，行为不变
- CI 两处 workflow 均指向 Playwright 而非已删文件
- auth.setup.ts 生成 `.auth/user.json` 供 chromium project 使用，无需改动
