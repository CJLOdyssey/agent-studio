# Fix 07: main 分支保护生效 Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p7 main -b fix/p7-branch-protection`）。只修改本文件列出的文件。

**Goal:** settings.yml job 名与实际 CI job 名对齐，并通过 settings-action 应用。
**Architecture:** 用稳定的最终门禁 `CI Passed` 替代不稳定的矩阵 job 名；新增手动 dispatch 的 settings-apply workflow。
**Tech Stack:** GitHub Actions / github/settings-action

## 并行协调

- 独占文件：`.github/settings.yml`、`.github/workflows/settings-apply.yml`（新）
- 无共享文件

## Global Constraints

- 不修改其它方案的独占文件
- 应用分支保护需要仓库 admin token（`ADMIN_GITHUB_TOKEN`），未配置时用 gh api 兜底
- 提交遵循 .gitmessage 格式

---

## 根因

`settings.yml:3-4` 自述 "desired-state，未被 workflow 应用"；且其中 job 名 `Backend Lint`/`Backend Tests`/`CI Summary`（L33-42）与 ci.yml 实际 job 名（`Backend: Lint & Typecheck`/`Backend: Tests (...)`/`CI Passed`）不一致 → main 分支保护实际未生效。

## Files

- Modify: `.github/settings.yml`
- Create: `.github/workflows/settings-apply.yml`

---

- [ ] **Step 1: settings.yml 对齐 job 名（用稳定的最终门禁 + 非矩阵 job）**

```yaml
branches:
  - name: main
    protection:
      required_status_checks:
        status_checks:
          - "CI Passed"
          - "Backend: Lint & Typecheck"
          - "Backend: Security"
          - "Frontend: Lint & Typecheck"
          - "Frontend: Build & Bundle"
          - "Security: Secrets Scan"
        strict: true
```

（矩阵 job `Backend: Tests (1)` 等名字不稳定，已由 `CI Passed` 兜底覆盖。）

- [ ] **Step 2: 创建 `.github/workflows/settings-apply.yml`**

```yaml
name: Apply Repository Settings
on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  apply:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/settings-action@v1
        with:
          token: ${{ secrets.ADMIN_GITHUB_TOKEN }}
          repository: CJLOdyssey/agent-studio
```

- [ ] **Step 3: 应用（二选一）**

手动 dispatch：`gh workflow run "Apply Repository Settings"`，或 gh api 直改：

```bash
gh api -X PATCH repos/CJLOdyssey/agent-studio/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]=CI%20Passed
```

- [ ] **Step 4: Commit**

```bash
git add .github/settings.yml .github/workflows/settings-apply.yml
git commit -m "ci: align branch protection job names & add settings-apply workflow"
```

## Self-Review

- `CI Passed` 是 ci.yml 最终聚合门禁，名字稳定
- settings-action 依赖 `ADMIN_GITHUB_TOKEN`；缺失时 gh api 可手动应用（Step 3 兜底）
- 不改动 ci.yml（P6 独占相关区域）
