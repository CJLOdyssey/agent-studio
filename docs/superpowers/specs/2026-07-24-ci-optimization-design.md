# CI 极致优化方案设计

**日期**: 2026-07-24
**目标**: 每个 CI job <30s，不减少功能门禁
**方案**: 预构建 Runner 镜像（方案 1）+ 重构 CI 结构（方案 3）

---

## 1. 当前现状

### 已有 job 耗时

| 分类 | Job | 当前耗时 | 目标 | 状态 |
|------|-----|---------|------|------|
| ✅ 已达标 | Detect Changes | 8s | <30s | ✅ |
| ✅ 已达标 | Docs & Config | 7s | <30s | ✅ |
| ✅ 已达标 | Security: Secrets Scan | 9s | <30s | ✅ |
| ✅ 已达标 | Security: Container Scan | 12s | <30s | ✅ |
| ✅ 已达标 | Backend: Diff Coverage | 27s | <30s | ✅ |
| ⚠️ 可优化 | Backend: Lint & Typecheck | 46s | <30s | ❌ |
| ⚠️ 可优化 | Backend: Security | 40s | <30s | ❌ |
| ⚠️ 可优化 | Frontend: Lint & Typecheck | 40s | <30s | ❌ |
| ⚠️ 可优化 | Frontend: Build & Bundle | 43s | <30s | ❌ |
| 🔴 困难 | Backend: Tests (tasks-1a) | 3m | <30s | ❌ |
| 🔴 困难 | Backend: Tests (7 shards) | 50s-1m | <30s | ❌ |
| 🔴 困难 | Backend: Coverage | 38s | <30s | ❌ |
| 🔴 困难 | Backend: Flaky Tests | 35s | <30s | ❌ |
| 🔴 困难 | Backend: Load Test | 1m | <30s | ❌ |
| 🔴 困难 | Backend: Requirement Coverage | 1m | <30s | ❌ |
| 🔴 困难 | Frontend: Test (2 shards) | ~1m | <30s | ❌ |
| 🔴 困难 | Frontend: Coverage (4 shards + report) | ~1m × 5 | <30s | ❌ |
| 🔴 困难 | Frontend: Size Limit | ~1m | <30s | ❌ |
| 🔴 困难 | Integration (legacy + rbac) | ~1m × 2 | <30s | ❌ |
| 🔴 困难 | OpenAPI: Schema Validation | ~1m | <30s | ❌ |
| 🔴 困难 | Frontend: E2E Smoke | 6m | <30s | ❌ |

### 核心瓶颈

1. **pip install (~20s)** — 几乎占 30s 预算的 67%
2. **npm ci (~15s)** — 占 30s 预算的 50%
3. **playwright install chromium (~30s)** — 占 30s 预算的 100%+
4. **mypy --strict 首次运行** — 冷缓存 15-20s
5. **串行步骤** — lint → typecheck 串行浪费缓存预热
6. **重复运行测试** — frontend-test 和 frontend-coverage 跑同一套测试
7. **大 test shard** — tasks-1a 单 shard 3 分钟
8. **冗余 job** — size-limit 依赖 build 输出单独 job，coverage-report 单独 job

---

## 2. 总体架构

### CI Pipeline 4 层

```
Layer 1: 快速门禁 (<15s)
  Detect Changes, Secrets Scan, Container Scan, Docs & Config
         │
Layer 2: 构建 + Lint (<25s)
  Backend Lint, Backend Security, Frontend Lint, Frontend Build (含 size-limit)
         │
Layer 3: 测试 + 验证 (<30s)
  Backend Test shards (内联 coverage), Frontend Test shards (内联 coverage),
  Integration (含 OpenAPI), Frontend E2E
         │
Layer 4: 聚合门禁 (<5s)
  CI Passed (仅检查结果)
```

### 预构建镜像策略

创建自定义 Docker 镜像，预装所有依赖，每周自动重建。

```dockerfile
FROM ghcr.io/actions/runner-images:ubuntu-latest

COPY requirements-lock.txt /
RUN pip install --no-compile -r requirements-lock.txt && \
    pip install playwright locust && \
    playwright install chromium --with-deps

COPY frontend/package.json frontend/package-lock.json /frontend/
RUN cd /frontend && npm ci --prefer-offline --no-audit

# 预热 mypy 缓存
RUN mypy --cache-dir /opt/mypy-cache backend/ --strict --no-error-summary || true

# 预构建 TypeScript + Vite（加速 frontend-build 和 E2E）
WORKDIR /frontend
RUN npm run build

# 缓存 tsc incremental
RUN npx tsc --noEmit
```

构建触发条件：
- 每周日 cron 自动构建
- `requirements-lock.txt`、`package-lock.json`、`Dockerfile` 变更时触发
- 支持 workflow_dispatch 手动触发

---

## 3. 每个 Job 的优化方案

### Layer 1: 快速门禁（5 job，无需改动）

| Job | 当前 | 优化后 | 措施 |
|-----|------|--------|------|
| Detect Changes | 8s | 8s | 不变 |
| Security: Secrets Scan | 9s | 9s | 不变 |
| Security: Container Scan | 12s | 12s | 不变 |
| Docs & Config | 7s | 7s | 不变 |

### Layer 2: 构建 + Lint

| Job | 当前 | 优化后 | 措施 |
|-----|------|--------|------|
| Backend: Lint & Typecheck | 46s | **~18s** | 预装依赖 + mypy cache 命中 + ruff/mypy 并行 |
| Backend: Security | 40s | **~15s** | 预装后 pip-audit + bandit 只需 10s |
| Frontend: Lint & Typecheck | 40s | **~12s** | 预装 + tsc incremental cache + lint/typecheck 并行 |
| Frontend: Build & Bundle | 43s | **~18s** | tsc cache hit → vite build (8s) + size-limit 内联 (+3s) |

**合并**：`frontend-size-limit` 合并到 `frontend-build`，删除独立 job。

### Layer 3: 测试与验证

| Job | 当前 | 优化后 | 措施 |
|-----|------|--------|------|
| Backend: Tests (routers) | ~1m | **~22s** | 预装 + 内联 coverage |
| Backend: Tests (repository) | ~1m | **~22s** | 同上 |
| Backend: Tests (core-infra) | ~1m | **~22s** | 同上 |
| Backend: Tests (services) | ~1m | **~22s** | 同上 |
| Backend: Tests (tasks-1a) | **3m** | **~25s × 4** | 拆成 4 片（原 1 片） |
| Backend: Tests (tasks-1b) | 51s | **~22s** | 预装 |
| Backend: Tests (tasks-2) | 50s | **~22s** | 预装 |
| Backend: Coverage | 38s | **合并到 test** | 每个 shard 内联 `--cov` + upload，merge step 独立 |
| Backend: Diff Coverage | 27s | **~18s** | 预装 |
| Backend: Flaky Tests | 35s | **~20s** | 预装 |
| Backend: Load Test | 1m | **~25s** | 合并到 integration（共用 backend） |
| Backend: Requirement Coverage | 1m | **~25s** | 预装 + 缩减 ignore 列表 |
| Frontend: Test (1/2) | ~1m | **~20s** | 预装 + coverage 内联 |
| Frontend: Test (2/2) | ~1m | **~20s** | 预装 + coverage 内联 |
| Integration (legacy + rbac) | ~1m × 2 | **~25s × 2** | 预装 + 合并 OpenAPI |
| Frontend: E2E Smoke | **6m** | **~25s** | 见下方 E2E 专项优化 |

**删除**：`frontend-coverage` (×4)、`frontend-coverage-report` — 数据在 test job 内联生成并合并。
**合并**：`openapi-diff` 合并到 `integration` job，复用已启动的 backend 实例。

### Frontend E2E 专项优化

从 6min → ~25s 的核心措施：

| 优化 | 节省时间 | 说明 |
|------|---------|------|
| 预构建镜像（pip/npm/playwright 预装） | ~60s | playwright install chromium 从 30s → 0s |
| `vite preview` 替代 `vite dev` | ~15s | 直接用预构建的 dist/，无需 watch 模式 |
| 并行启动 backend + frontend | ~10s | 同时启动两个服务 |
| API 测试在启动期间并行跑 | ~5s | 9 个 API 测试不依赖浏览器 |
| 共享 page 实例，去除冗余 goto | ~60s | 20 个 browser 测试共享一个 page，无需每个都 goto |
| 移除/替代 wait_for_timeout | ~20s | 用 wait_for_selector / to_be_visible 替代硬等 |
| B13 12s 超时缩短 | ~9s | 从 12s 缩短到 3s |

### Layer 4: 聚合门禁

| Job | 当前 | 优化后 | 措施 |
|-----|------|--------|------|
| CI Passed | 3s | **<1s** | 简化依赖（删除已合并的 job） |

---

## 4. 文件变动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `.github/ci-image/Dockerfile` | 预构建 CI runner 镜像 |
| `.github/workflows/ci-image-build.yml` | 镜像自动构建 workflow |

### 新增复合 Actions

| 文件 | 说明 |
|------|------|
| `.github/actions/setup-backend/action.yml` | 复用 backend 环境（预装、cache、验证） |
| `.github/actions/setup-frontend/action.yml` | 复用 frontend 环境 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `.github/workflows/ci.yml` | 全面重构：container 引用、job 合并、shard 拆分、E2E 优化 |

### E2E 测试优化

| 文件 | 改动 |
|------|------|
| `frontend/e2e/smoke_tests.py` | 共享 page 实例、移除冗余 goto、替换 wait_for_timeout |

---

## 5. 预估结果

| 指标 | 当前 | 优化后 |
|------|------|--------|
| 总 job 数 | 32 | **~24**（删除 5 个，合并 3 个） |
| 达标 job 数 (<30s) | 5 | **~22**（92%） |
| 未达标 job | Frontend E2E (6min) | Frontend E2E: **~25s ✅** |
| 最长单个 job | Frontend E2E: 6min | **Frontend E2E: ~25s** |
| 总 CI wall-clock | ~8-10min | **~30-45s**（并行） |

### 不达标风险分析

| Job | 预估 | 风险 | 兜底 |
|-----|------|------|------|
| Frontend E2E | ~25s | 测试执行可能超时 | 进一步拆分 API 测试为独立 job |
| Backend: Tests (tasks-1a) | ~25s | 某片测试偏多 | 继续拆分到 6-8 片 |
| Integration | ~25s | 服务启动不稳定 | 使用 Docker service container 替代手动启动 |

---

## 6. 实现优先级

### Phase 1：快速见效（立即）
1. 创建预构建镜像 + 自动构建 workflow
2. 所有 job 引用 container 镜像
3. 删除所有 pip/npm/playwright install 步骤

### Phase 2：Job 优化（Phase 1 后）
4. 合并 frontend-coverage → frontend-test
5. 合并 size-limit → frontend-build
6. 合并 openapi-diff → integration
7. 拆分 tasks-1a 为 4 片

### Phase 3：E2E 专项（Phase 2 后）
8. 共享 page 实例 + 移除冗余导航
9. 替换 wait_for_timeout
10. 并行化 API 测试

### Phase 4：收尾
11. 简化 CI Passed 依赖
12. 验证所有 job <30s
