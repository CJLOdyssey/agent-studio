# Fix 06: 假门禁修复（container-scan + requirement-coverage gate）Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p6 main -b fix/p6-gates`）。只修改本文件列出的文件。

**Goal:** container-scan 真实拦截 HIGH/CRITICAL；`requirement-coverage` 失败也挡住 CI。
**Architecture:** trivy `exit-code: 0`→`1`（两处）；`ci-passed` gate 函数加入 `requirement-coverage` 检查。
**Tech Stack:** GitHub Actions / trivy

## 并行协调

- 独占文件：`.github/workflows/ci.yml`（trivy L188/L195 + gate 函数 L725-753）
- ci.yml 共享：编辑 trivy 段与 gate 函数，与 P1(L400)/P8(L449)/P2(L537) 不重叠；**merge 顺序 P1→P8→P2→P6（本方案最后）**

## Global Constraints

- 不修改其它方案的独占文件
- 提交遵循 .gitmessage 格式

---

## 根因

① `ci.yml:188,195` trivy-action 设 `exit-code: 0` → 扫描恒绿；`ci-passed` 门禁（L744-748）专门检查 `container-scan.result == failure`，该分支永远不触发，"container-scan 是 hard gate"的注释名存实亡。② `ci.yml:704` 在 `needs` 列了 `requirement-coverage`，但 gate 函数（L725-737）从未评估它，其失败不会挡住 CI。

## Files

- Modify: `.github/workflows/ci.yml`

---

- [ ] **Step 1: trivy exit-code 0 → 1（两处，L188/L195）**

```yaml
          severity: CRITICAL,HIGH
          exit-code: 1
```

- [ ] **Step 2: gate 函数加 requirement-coverage 检查**

在 `ci-passed` 的 `check()` 序列中加入（L725-737 区域）：

```yaml
          check "backend-lint" "${{ needs.backend-lint.result }}" || FAIL=1
          check "backend-security" "${{ needs.backend-security.result }}" || FAIL=1
          check "requirement-coverage" "${{ needs.requirement-coverage.result }}" || FAIL=1
```

- [ ] **Step 3: 本地验证 trivy 无 HIGH/CRITICAL**

```bash
# 若本机无 trivy，用 docker 验证（网络可用时）
docker run --rm -v "$PWD":/scan aquasec/trivy config --severity CRITICAL,HIGH --exit-code 1 /scan/docker /scan/frontend/Dockerfile 2>&1 | tail -20
# 期望：exit 0（无 CRITICAL/HIGH）。若检出问题，先修 Dockerfile 再提交。
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: make container-scan & requirement-coverage real gates"
```

## Self-Review

- trivy 设 exit-code:1 后，若当前 Dockerfile 存在 CRITICAL/HIGH 配置问题，CI 会拦截——Step 3 已前置验证
- gate 函数同时保留既有 container-scan 检查（其 `result==failure` 现在可能触发）
- `requirement-coverage` 已在 `needs` 中（L704），只需加评估
