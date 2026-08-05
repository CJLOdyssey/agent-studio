# Fix 09: docs 入库（解除 gitignore）Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p9 main -b fix/p9-docs`）。只修改本文件列出的文件。

**Goal:** 让架构/设计文档可随 PR review、clone 即得。
**Architecture:** 从 .gitignore 移除 `docs/`（保留截图排除规则），将 md 文档入库。
**Tech Stack:** git

## 并行协调

- 独占文件：`.gitignore`（docs 段，L102-107）、`docs/**`（入库）
- **依赖 N2（对标文档）**：`docs/benchmark/2026-08-05-competitor-benchmark.md` 建议**先于本方案 merge**，这样 Step 2 的 `git add docs/` 会一并将其入库；若 N2 后 merge 则该文档以独立 commit 入库（不影响并行）。

## Global Constraints

- 不修改其它方案的独占文件
- 大体积截图（png/jpeg）不入库，仅 md
- 提交遵循 .gitmessage 格式

---

## 根因

`.gitignore:103` `docs/` 使 63 个 md 全部不入库（`git ls-files docs/` 仅 33 个 PNG 截图）；`AGENTS.md/CLAUDE.md/RUNBOOK.md` 的 ignore 行为死配置（已跟踪文件不受 ignore 影响，但误导）。README 指向的 AGENTS.md/RUNBOOK.md 外部贡献者 clone 后拿不到。

## Files

- Modify: `.gitignore`
- Stage: `docs/**`（md 文件）

---

- [ ] **Step 1: 修改 .gitignore**

```gitignore
# Docs are versioned — keep screenshots out
docs/e2e-*.png
docs/superpowers/plans/*.png
```

删除原 `docs/`（L103）、`AGENTS.md`（L106）、`CLAUDE.md`（L107）、`RUNBOOK.md` 行。⚠️ 已核验：`RUNBOOK.md` 文件**不存在**（README 引用它是死链）——移除 ignore 行为死配置清理，无文件可入库；可顺带在 README 里把 RUNBOOK 链接改指 docs/benchmark 或删除。

- [ ] **Step 2: 入库文档**

```bash
git add docs/ AGENTS.md CLAUDE.md 2>/dev/null
git status | head -20
# 期望：docs/ 下 md 全部 staged（RUNBOOK.md 不存在，不 add）
```

- [ ] **Step 3: 确认大文件不入库**

```bash
git add -n docs/ | grep -E "png|jpeg" | head
# 期望：无 png 被加（e2e-*.png 与 plans/*.png 已排除）；若有其它大图，继续加 ignore 规则
```

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: version project docs (architecture, design-review, runbook)"
```

## Self-Review

- 截图（png）仍被排除，仓库体积可控
- AGENTS.md/CLAUDE.md 已在库中，remove ignore 行是清理死配置
- 提交体积较大（63 个 md），可拆 2 个 commit（先 docs/，再根级 md）
