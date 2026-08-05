# Phase 3b: 弹窗体系 Tailwind 替换 实施计划

**Goal:** 将 modals/*.css (8文件, 1,344行) 替换为 Tailwind className

---

### Task 1: Migrate modals/agent.css

- Read `frontend/src/styles/modals/agent.css`
- Search TSX for class usage
- Replace className with Tailwind in the modal TSX files
- Keep CSS file for import chain
- Verify: `cd frontend && npx tsc --noEmit`
- Commit per group

### Task 2: Migrate modals/api.css + settings.css + workspace.css + confirm.css + picker.css

Same procedure as Task 1.

### Task 3: Run full tests + fix failures

After all modals CSS migrated, run `npx vitest run` and fix any test failures.
