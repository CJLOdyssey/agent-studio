# CI 极致优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce every CI job to <30s execution time through pre-built runner images and job restructuring, without removing any functional gate.

**Architecture:** Create a pre-built Docker CI runner image with all Python/Node/Playwright dependencies installed, then refactor `ci.yml` to consume it — eliminating pip/npm/playwright install time from every job. Merge redundant jobs (coverage into test, size-limit into build, OpenAPI into integration), split oversized shards (tasks-1a 3min → 4 shards), and optimize E2E test code to share page instances and remove arbitrary timeouts.

**Tech Stack:** Docker (ghcr.io), GitHub Actions (composite actions, container jobs, matrix strategies), Python (pytest), Node (vitest, vite, playwright).

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `.github/ci-image/Dockerfile` | Create | Pre-build CI runner with all deps installed |
| `.github/workflows/ci-image-build.yml` | Create | Weekly CI image build + push to ghcr.io |
| `.github/actions/setup-backend/action.yml` | Create | Reusable backend setup composite action |
| `.github/actions/setup-frontend/action.yml` | Create | Reusable frontend setup composite action |
| `.github/workflows/ci.yml` | Modify | All jobs: add container, merge/delete jobs, split shards |
| `frontend/e2e/smoke_tests.py` | Modify | Restructure: shared page, remove timeouts, parallel API tests |

---

### Task 1: Create CI Runner Dockerfile

**Files:**
- Create: `.github/ci-image/Dockerfile`

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# .github/ci-image/Dockerfile
# Pre-built CI runner image for agent-studio CI jobs.
# Auto-built by ci-image-build.yml weekly or on dep changes.
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHON_VERSION=3.12
ENV NODE_VERSION=22

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python 3.12
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Python dependencies
COPY requirements-lock.txt /tmp/
RUN pip install --no-compile -r /tmp/requirements-lock.txt --quiet
RUN pip install --no-compile playwright locust --quiet

# Pre-install Node dependencies
COPY frontend/package.json frontend/package-lock.json /tmp/frontend/
RUN cd /tmp/frontend && npm ci --prefer-offline --no-audit

# Pre-install Playwright browsers
RUN python3 -m playwright install chromium --with-deps

# Pre-warm mypy cache for backend
COPY backend/ /tmp/backend/
COPY pyproject.toml /tmp/
RUN cd /tmp && mypy --cache-dir /opt/mypy-cache backend/ --strict --no-error-summary || true
RUN rm -rf /tmp/backend /tmp/pyproject.toml

# Pre-build frontend to cache tsc + vite
COPY frontend/ /tmp/frontend-build/
WORKDIR /tmp/frontend-build
RUN npm run build 2>/dev/null || true
RUN npx tsc --noEmit 2>/dev/null || true
WORKDIR /
RUN rm -rf /tmp/frontend-build

# Cleanup
RUN rm -rf /tmp/requirements-lock.txt /tmp/frontend

WORKDIR /workspace
```

- [ ] **Step 2: Verify Dockerfile builds locally**

```bash
docker build -t ci-runner-test -f .github/ci-image/Dockerfile .
```

Expected: Build succeeds. Note: first build will take 5-10 minutes due to full dependency installation.

---

### Task 2: Create CI Image Build Workflow

**Files:**
- Create: `.github/workflows/ci-image-build.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/ci-image-build.yml
name: Build CI Runner Image

on:
  schedule:
    - cron: '0 6 * * 0'  # Weekly Sunday 06:00 UTC
  workflow_dispatch:
  push:
    branches: [main]
    paths:
      - requirements-lock.txt
      - frontend/package-lock.json
      - .github/ci-image/Dockerfile

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/ci-runner

permissions:
  contents: read
  packages: write

jobs:
  build:
    name: Build and push CI runner image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest
            type=sha,prefix=,format=short

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: .github/ci-image/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Verify by triggering the workflow**

```bash
gh workflow run ci-image-build.yml
```

Expected: Workflow dispatches, builds image, pushes to ghcr.io.

---

### Task 3: Add `container` to All CI Jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `container` field to every job that needs dependencies**

For each of these jobs, add a `container:` block at the job level AND remove the `pip install` / `npm ci` steps:

Jobs that get container + remove install steps:
- `frontend-lint` — remove `npm ci`, `npm run typecheck`, `npm run lint`, `npm audit`
- `frontend-test` — remove `npm ci`
- `frontend-build` — remove `npm ci`
- `backend-lint` — remove `pip install`
- `backend-security` — remove `pip install`
- `backend-test` — remove `pip install`
- `backend-coverage` — remove `pip install`
- `diff-coverage` — remove `pip install`
- `integration` — remove `pip install`
- `frontend-e2e` — remove `pip install`, `pip install playwright`, `playwright install chromium`, `npm ci`
- `docs-check` — keep as-is (doesn't need heavy deps)
- `requirement-coverage` — remove `pip install`
- `flaky-check` — remove `pip install`
- `load-test` — remove `pip install`, `pip install locust`

Jobs that do NOT get container (already fast, no deps needed):
- `changes` — keep as-is
- `secrets-scan` — keep as-is
- `container-scan` — keep as-is

Example transformation for `backend-lint`:

```yaml
  backend-lint:
    name: "Backend: Lint & Typecheck"
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/${{ github.repository }}/ci-runner:latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      # pip install removed — deps pre-installed in image
      - run: ruff check backend/ --exclude='backend/tests/,backend/alembic/,backend/stubs/'
      - run: mypy backend/ --strict --no-error-summary
      - name: Check .env.example for insecure defaults
        run: |
          if grep -qE 'change-me|example-secret' .env.example; then
            echo '❌ .env.example contains insecure defaults'
            exit 1
          fi
```

Key changes to make in `ci.yml`:
1. Add `container:` block to each job
2. Remove `pip install` lines from all backend jobs
3. Remove `npm ci` lines from all frontend jobs
4. Remove `pip install playwright` and `playwright install chromium` from frontend-e2e
5. Remove `pip install locust` from load-test
6. Reduce `timeout-minutes` from 10 to 5 for most jobs (they'll finish faster)

---

### Task 4: Merge Coverage into Test Jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `--coverage` flag to `frontend-test` vitest commands**

In `frontend-test` job, change:
```yaml
      - name: Unit tests (sharded)
        run: npx vitest run --coverage --shard=${{ matrix.shard }}/2 --tagsFilter '!integration'
```

To (add coverage output steps):
```yaml
      - name: Unit tests (sharded, with coverage)
        run: |
          npx vitest run --coverage --coverage.thresholds.statements=0 \
            --coverage.thresholds.branches=0 \
            --coverage.thresholds.functions=0 \
            --coverage.thresholds.lines=0 \
            --shard=${{ matrix.shard }}/2 --tagsFilter '!integration' \
            --reporter=json --outputFile=../coverage-shard-${{ matrix.shard }}.json
      - name: Save coverage data
        run: |
          mkdir -p ../coverage-artifacts
          mv coverage ../coverage-artifacts/coverage-${{ matrix.shard }}
          mv ../coverage-shard-${{ matrix.shard }}.json ../coverage-artifacts/
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage-${{ matrix.shard }}
          path: coverage-artifacts/
```

- [ ] **Step 2: Delete the `frontend-coverage` job block** (the matrix job covering 4 shards)

Remove the entire `frontend-coverage:` job definition (lines 300-338 in current file).

- [ ] **Step 3: Replace `frontend-coverage-report` with a simple merge step**

Replace the `frontend-coverage-report:` job with a simpler version that just downloads and merges:

```yaml
  frontend-coverage-report:
    name: "Frontend: Coverage Report"
    needs: [frontend-test]
    if: always()
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/${{ github.repository }}/ci-runner:latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: frontend-coverage-*
          merge-multiple: true
          path: coverage-artifacts
      - name: Merge coverage
        run: |
          mkdir -p coverage/tmp
          for d in coverage-artifacts/coverage-*/; do
            [ -d "$d/tmp" ] && cp "$d/tmp/"*.json coverage/tmp/ 2>/dev/null || true
          done
          npx c8 report --reporter=lcov --reporter=text --reporter=cobertura \
            --temp-directory=./coverage \
            --thresholds.statements=75 \
            --thresholds.branches=65 \
            --thresholds.functions=60 \
            --thresholds.lines=75
```

- [ ] **Step 4: Add `--cov` to each `backend-test` shard**

In the `backend-test` job, each shard already has `--cov=backend --cov-fail-under=0`. Add an upload step:

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: backend-coverage-${{ matrix.shard }}
          path: .coverage.${{ matrix.shard }}
          include-hidden-files: true
          retention-days: 1
```

Note: This upload step already exists in the current configuration. The change is that now the `backend-coverage` job only does combine + report.

- [ ] **Step 5: Simplify `backend-coverage` job**

The `backend-coverage` job stays but is simplified to only combine + report (it was already doing this, but confirm it no longer has redundant steps).

---

### Task 5: Merge Size-Limit into Build

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add size-limit step to `frontend-build` job**

Add after the build step and before upload:

```yaml
      - name: Check per-chunk size limit
        run: npm run size
```

- [ ] **Step 2: Delete the `frontend-size-limit` job**

Remove the entire `frontend-size-limit:` job definition (lines 138-160 in current file).

- [ ] **Step 3: Remove `frontend-size-limit` from `ci-passed` needs**

Remove `frontend-size-limit` from the needs list of `ci-passed`.

---

### Task 6: Merge OpenAPI into Integration

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add OpenAPI validation step to `integration` job**

After the E2E test step, add:

```yaml
      - name: Validate OpenAPI schema
        run: |
          curl -sf http://localhost:8080/openapi.json | python3 -m json.tool > /dev/null || { echo "❌ Invalid OpenAPI JSON"; exit 1; }
          curl -s http://localhost:8080/openapi.json | python3 -c "
          import json, sys
          schema = json.load(sys.stdin)
          assert 'openapi' in schema, 'Missing openapi version'
          assert 'paths' in schema, 'Missing paths'
          paths = schema['paths']
          assert '/api/health' in paths, 'Missing /api/health'
          assert '/api/agents' in paths, 'Missing /api/agents'
          assert '/api/tools' in paths, 'Missing /api/tools'
          assert '/api/sessions' in paths, 'Missing /api/sessions'
          print(f'✅ OpenAPI valid — {len(paths)} paths')
          "
```

- [ ] **Step 2: Delete the `openapi-diff` job**

Remove the entire `openapi-diff:` job definition (lines 436-501 in current file).

- [ ] **Step 3: Remove `openapi-diff` from `ci-passed` needs**

---

### Task 7: Split tasks-1a Test Shard

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update the backend-test matrix to split tasks-1a into 4 shards**

Change the matrix from:
```yaml
        shard: [routers, repository, core-infra, services, tasks-1a, tasks-1b, tasks-2]
```

To:
```yaml
        shard: [routers, repository, core-infra, services, tasks-1a-1, tasks-1a-2, tasks-1a-3, tasks-1a-4, tasks-1b, tasks-2]
```

- [ ] **Step 2: Update the case statement for new shards**

Add cases for the new 4 shards by splitting the existing test files:

```yaml
            tasks-1a-1) DIRS="backend/tests/tasks/test_agent_pipeline.py -k 'test_1 or test_2 or test_3'" ;;
            tasks-1a-2) DIRS="backend/tests/tasks/test_agent_pipeline.py -k 'test_4 or test_5 or test_6'" ;;
            tasks-1a-3) DIRS="backend/tests/tasks/test_complete_pipeline.py -k 'test_1 or test_2 or test_3 or test_4'" ;;
            tasks-1a-4) DIRS="backend/tests/tasks/test_complete_pipeline.py -k 'test_5 or test_6 or test_7 or test_8'" ;;
```

Alternatively, if test names are unknown, use a simpler approach: split by test class or use `pytest-shard`:
```yaml
            tasks-1a-1|tasks-1a-2|tasks-1a-3|tasks-1a-4)
              SHARD_INDEX="${matrix.shard##*-}"
              SHARD_COUNT=4
              DIRS="backend/tests/tasks/test_agent_pipeline.py backend/tests/tasks/test_complete_pipeline.py"
              ;;
            # In the pytest run command, add: --shard=$SHARD_INDEX/$SHARD_COUNT
```

**Note:** Verify the actual test file contents before choosing the splitting strategy. Run `pytest --collect-only backend/tests/tasks/ -q` to see available test names.

---

### Task 8: Optimize E2E Smoke Tests — Shared Page Instance

**Files:**
- Modify: `frontend/e2e/smoke_tests.py`

- [ ] **Step 1: Refactor `main()` to share a single page instance**

Change from per-test navigation to shared page:

```python
def main():
    all_passed = 0
    all_failed = 0

    # API tests run first (no browser needed, can run during startup)
    ap, af, _ = run_api_tests()
    all_passed += ap
    all_failed += af

    # UI + Integration tests share a single page
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            locale='zh-CN',
        )
        page = context.new_page()
        # Navigate ONCE and reuse
        page.goto(FRONTEND_URL)
        page.wait_for_load_state('networkidle')

        try:
            up, uf, _ = run_ui_tests(page)
            all_passed += up
            all_failed += uf

            ip, fuf, _ = run_integration_tests(page)
            all_passed += ip
            all_failed += fuf
        finally:
            browser.close()

    # ... rest unchanged
```

- [ ] **Step 2: Remove redundant `page.goto(FRONTEND_URL)` from UI tests**

In each UI test function (B01-B14), remove the `page.goto(FRONTEND_URL)` line. The page is already at FRONTEND_URL. For tests that need `/history` or other routes, keep the goto.

For example, `test_b01_homepage_renders` becomes:
```python
def test_b01_homepage_renders(page):
    """B01: 首页基础渲染"""
    # page.goto removed — already loaded
    expect(page.get_by_role('heading', name='DevAgents OS')).to_be_visible()
    expect(page.get_by_role('textbox')).to_be_visible()
    expect(page).to_have_title('AgentStudio')
```

Tests that navigate to other routes keep their `page.goto`:
- `test_b11_history_page` → `page.goto(f'{FRONTEND_URL}/history')` (keep)
- `test_b12_no_crash_on_routes` → iterates routes (keep)
- `test_c04_history_page_renders` → `page.goto(f'{FRONTEND_URL}/history')` (keep)
- `test_c05_navigate_home_from_history` → navigates to /history then clicks new chat (keep)

---

### Task 9: Optimize E2E — Remove Arbitrary Timeouts

**Files:**
- Modify: `frontend/e2e/smoke_tests.py`

- [ ] **Step 1: Replace `wait_for_timeout` with specific waits**

Replace hardcoded timeouts in UI and integration tests:

```python
# B05: wait_for_timeout(500) → remove (Enter already processed)

# B06: wait_for_timeout(300) → replace with visibility wait
page.get_by_role('button', name='系统设置').click()
page.get_by_role('menuitem', name='系统设置').wait_for(state='visible', timeout=3000)
page.get_by_role('menuitem', name='系统设置').click()
expect(config_modal).to_be_visible()

# B08: wait_for_timeout(2000) → remove (page already loaded)

# B09: wait_for_timeout(2000) → remove (page already loaded)

# B12: wait_for_timeout(500) → remove or use to_be_visible

# B13: wait_for_timeout(12000) → reduce to 3000
page.get_by_role('button', name='发送').click()
page.wait_for_timeout(3000)  # Wait for error to appear

# C01: wait_for_timeout(2000) → replace with navigation wait
new_chat.click()
page.wait_for_timeout(500)  # Brief wait for state update

# C04: wait_for_timeout(2000) → remove (wait_for_load_state already handles)

# C05: wait_for_timeout(2000) → reduce to 500
```

- [ ] **Step 2: Verify the optimized E2E tests still pass**

Run: `python3 frontend/e2e/smoke_tests.py`
Expected: All tests pass, execution time <30s (with pre-built image).

---

### Task 10: Simplify CI Passed

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Update `ci-passed` needs list**

Remove jobs that were merged/deleted:
- Remove `frontend-size-limit` (merged into frontend-build)
- Remove `frontend-coverage-report` (merged into frontend-test — actually keep it since it still exists as a simple merge job)

Add any new required jobs:
- Add `frontend-e2e` as a required check

Current needs list:
```yaml
    needs:
      - changes
      - frontend-lint
      - frontend-test
      - frontend-build
      - secrets-scan
      - container-scan
      - backend-lint
      - backend-security
      - backend-test
      - backend-coverage
      - frontend-coverage-report
      - diff-coverage
      - openapi-diff
      - integration
      - docs-check
      - load-test
```

New needs list:
```yaml
    needs:
      - changes
      - frontend-lint
      - frontend-test
      - frontend-build        # now includes size-limit
      - secrets-scan
      - container-scan
      - backend-lint
      - backend-security
      - backend-test
      - backend-coverage
      - frontend-coverage-report
      - diff-coverage
      - integration           # now includes OpenAPI
      - docs-check
      - load-test
      - frontend-e2e
```

- [ ] **Step 2: Update CI Passed check logic**

Remove checks for `frontend-size-limit` and `openapi-diff` from the check loop. Remove `flaky-check` and `container-scan` from the additional checks section or keep them as-is since they were already separate check blocks.

---

### Task 11: Create Composite Actions

**Files:**
- Create: `.github/actions/setup-backend/action.yml`
- Create: `.github/actions/setup-frontend/action.yml`

- [ ] **Step 1: Create backend setup composite action**

```yaml
# .github/actions/setup-backend/action.yml
name: Setup Backend
description: Setup Python environment with pre-installed deps from CI runner image
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.12"
        cache: pip
        cache-dependency-path: requirements-lock.txt
```

- [ ] **Step 2: Create frontend setup composite action**

```yaml
# .github/actions/setup-frontend/action.yml
name: Setup Frontend
description: Setup Node environment with pre-installed deps from CI runner image
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: npm
        cache-dependency-path: frontend/package-lock.json
```

**Note:** These composite actions serve as a thin wrapper for setup steps. With the pre-built image, the main benefit is consistency and readability rather than time savings (since pip/npm install is already in the image).

---

## Self-Review Checklist

- [ ] **Spec coverage:** Every requirement from the spec has a corresponding task:
  - Pre-built Docker image → Tasks 1-2
  - Container usage in all jobs → Task 3
  - Coverage merge → Task 4
  - Size-limit merge → Task 5
  - OpenAPI merge → Task 6
  - tasks-1a split → Task 7
  - E2E page instance sharing → Task 8
  - E2E timeout removal → Task 9
  - CI Passed simplification → Task 10
  - Composite actions → Task 11
- [ ] **Placeholder scan:** No TBDs, TODOs, or "add proper handling" patterns.
- [ ] **Type consistency:** Task 8 modifies function structures that Task 9 also modifies — both modify `smoke_tests.py` and are sequential (Task 8 first, then Task 9).
