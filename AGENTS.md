# AGENTS.md — AgentStudio

Multi-repo: `frontend/` (React 18 + Vite 6 + Tailwind 3) + `virtual_team/` (FastAPI + SQLAlchemy async).  
Three startup methods, each uses different ports (see [QUICKSTART.md](./QUICKSTART.md) for details).  
Frontend Vite proxy defaults to `http://localhost:8080`; override via `VITE_API_BASE_URL` for other methods.

## Quick start

| # | 方式 | 后端 | 前端 | 命令 |
|---|------|------|------|------|
| 1 | 🐳 本地 Docker | **8080** | **5173** | `docker compose -f docker/compose.local.yml up -d` |
| 2 | 🔀 混合模式 | **8081** | **5174** | Docker PG/Redis + `DATABASE_URL=... uvicorn --port 8081` + `npm run dev -- --port 5174` |
| 3 | ☁️ 云 Docker | 远程 | 远程 | `docker compose -f docker/compose.prod.yml up -d` |

```bash
# 🐳 Method 1 — Docker (everything, no manual setup needed)
docker compose -f docker/compose.local.yml up -d

# 🔀 Method 2 — 混合模式 (Docker PG/Redis, local hot-reload)
# ① infra: docker compose -f docker/compose.local.yml up -d postgres redis
# ② backend (explicit DATABASE_URL overrides shell env if already set):
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/virtual_team PYTHONPATH=. uvicorn virtual_team.app:app --reload --port 8081  # → :8081
# ③ frontend:
cd frontend && VITE_API_BASE_URL=http://localhost:8081 npm run dev -- --port 5174  # → :5174

# CLI single run (needs DB + Redis)
PYTHONPATH=. python3 -m virtual_team.main "<需求描述>"
```

**Always `PYTHONPATH=.`** for backend commands — project is not installed as a package.

## Commands

| Action | Frontend (`frontend/`) | Backend (root) |
|--------|----------------------|----------------|
| Build | `npm run build` (`tsc -b && vite build`) | — |
| Typecheck | `npm run typecheck` | `mypy virtual_team/ --strict` |
| Lint | `npm run lint` (ESLint) | `ruff check virtual_team/` |
| Format | `npm run format` (Prettier) | — (ruff handles) |
| Test | `npm test` (Vitest) | `PYTHONPATH=. python3 -m pytest tests/ -v --tb=short` |
| E2E test | — | `PYTHONPATH=. AUTH_MODE=legacy CHECKPOINTER_BACKEND=memory python3 -m pytest tests/e2e/test_e2e_full_flow.py -v --tb=short` |
| Coverage | `npm run test:coverage` | — |
| DB migrate | — | `PYTHONPATH=. alembic upgrade head` |


**CI order** (match locally): Frontend `typecheck → lint → build → test`, Backend `ruff → mypy → pytest`.

## Architecture

### Frontend

```
AgentStudioWorkstation.tsx (chat + sidebar + workstation layout)
  └─ WorkstationPage.tsx (9-tab → ErrorBoundary per module)
       ├─ agent/, prompt/, output/, tool/, mcp/, skill/, team/  ← CRUD
       ├─ monitor/, logs/                                       ← display-only
       └─ shared/ (ErrorBoundary, LoadingSkeleton, modals, ...)
  └─ modals/ (AgentConfigModal + tabs)
```

**Module convention**: Each CRUD module in its own dir with: `Management.tsx` + `FormModal.tsx` + `types.ts` + `constants.ts` + `mock-data.ts` + `api.ts` + `locales.ts` + `useXxxManagement.ts` + `index.ts`. Import via `index.ts` barrel only.

**DI pattern**: Each `api.ts` exports `let xxxAPI: XxxService = realImpl` + `setXxxAPI(mock)` for test swaps.

**State split**: Zustand `chatStore.ts` for UI/chat. TanStack Query for server data. Per-module `useXxxManagement.ts` hooks.

**i18n**: i18next, `zh-CN` fallback. Global keys in `src/i18n/locales/`. Module keys in `locales.ts`.

**CSS**: Plain CSS in `src/styles/` — `.wsta-*` prefix. Not CSS modules.

**Build chunks** (vite manualChunks): `vendor` (react/react-dom/router), `utils` (axios/zustand/crypto-js), `sentry`, `syntax`.

**TypeScript**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`. No `as any` / `@ts-ignore` / `@ts-expect-error`.

**Coverage thresholds** (Vitest enforced): statements 30%, branches 19%, functions 20%, lines 30%.

**Test setup** (`src/test/setup.tsx`): `TestProviders` wrapping QueryClient + SettingsProvider + ToastProvider. `scrollIntoView` / `scrollTo` / `matchMedia` mocked globally.

**nginx** (prod): API proxy → `backend:8080`, WS at `/ws`, assets cached 1y, SPA fallback.

### Backend

```
app.py (FastAPI lifespan, middleware: RateLimit → Auth → CORS → RequestLog)
  └─ routers/ (19 modules: admin, agent_test_handler, agents, attachments, auth, commands, keys, mcps, models,
   │            prompts, providers, run_continue, runs, sessions, skills, teams, tools, versions, workflows)
   │    └─ repository/ (23 modules: admin_stats, agents, attachments, auth, base, command_logs, core, deps, keys, keys_crud, keys_connectivity, mcps, memory_repo, message_repo, prompts, run_repo, session_repo, skills, snapshot_helper, teams, tools, versions, workflows)
  │         └─ database.py (24 ORM models, 24 tables incl. checkpoint)
  ├─ checkpoint.py (CheckpointDB + create_checkpointer factory)
  ├─ system_team/ (config.yaml + skill_agent/ + tools_agent/)
  └─ observability/ (7 modules: store, trace, handler, schema, analyzer, router, startup_guard)
       └─ EventStore (SQLite + background writer)
       └─ Debug API: GET /api/debug/{events,trace,errors,stats,health}
```

**Three-layer strict**: `database.py` (models) → `repository/` (async queries) → `routers/` (HTTP). Routers never touch database.py.

**Explicit re-exports**: `repository/__init__.py` uses named imports from each submodule — clear provenance tracking.

**Two graph engines**:
- `agent_graph.py`: LangGraph single-agent (`SingleAgentGraph`). Tool name prefixes: raw → none, MCP → `mcp_`, skill → `skill_`.
- `workflow/dynamic_team_graph.py`: LangGraph multi-agent (`DynamicTeamGraph`). Roles read from DB WorkflowConfig, configurable DAG via fan-out/fan-in.

**Celery tasks** (`tasks.py`): Parse JSON config fields → look up DB → create `ToolConfig` → bind to graph → execute via `asyncio.run()` (`_run_async` wrapper).

**Continuation flow** (interrupted → "继续生成"): POST `/api/runs/complete` → `routers/run_continue.py:create_complete_run`. Unlike the main flow (which goes through Celery), continuation runs **directly in the uvicorn process** via `asyncio.create_task(_complete_pipeline(...))`. This avoids Docker Celery worker image rebuilds when modifying continuation logic. The pipeline uses DeepSeek's prefix completion API (`/beta/chat/completions` with `thinking: {type: "enabled"}`) and streams results through the same Redis → WebSocket pipeline. Key constraint: the HTTP response returns immediately (background task), so the frontend must not depend on the POST response body for stream data.

**Streaming**: `StreamEmitter` → Redis pub/sub → frontend WebSocket. Thinking tokens buffered in `_pending_thinking`.

**Config** (`config.py`): Manual `.env` parser (env vars take precedence). `TeamConfig` Pydantic model with `extra="forbid"`.

**Checkpointer**: `create_checkpointer()` supports `memory` (test/CI), `sqlite` (default, writes `checkpoints.db`), `postgres`.

**Auth** (`AUTH_MODE`): `legacy` (fixed admin, no DB) or `rbac` (JWT HS256 + role lookup). `AUTH_ENABLED=1` to enforce.

**Error codes**: `ErrorCode` enum, 23 codes, format `{MODULE}_3DIGIT`. Use `error_response(ErrorCode.X, detail="...")`.

**Rate limiting**: Token-bucket via Redis. Default 60 req/60s per IP. Configurable.

**Key Vault**: Fernet-encrypted at-rest key storage. `KEY_VAULT_SECRET` ≥ 32 bytes.

**Streaming**: `StreamEmitter` → Redis pub/sub → frontend WebSocket. Thinking tokens buffered in `_pending_thinking`.

**Metrics**: Prometheus RED counters (`/metrics` endpoint).

**Mock fallback**: `ENABLE_MOCK_FALLBACK=1` returns canned LLM responses.

## Database

19 tables (18 models in `database.py` + `checkpoints` in `checkpoint.py`).

Key FK chains:
```
sessions (1) → project_runs (N) → chat_messages (N)
sessions (1) → memory_entries (N) → checkpoints (N)
agent_configs (1) → team_agents (N) ← teams (1)
user_api_keys (1) → key_usage_logs (N)
users (1) → user_roles (N) ← roles (1)
```

Migrations: Alembic in `alembic/`. Run `PYTHONPATH=. alembic upgrade head`.

## Docker

- **Backend** (`docker/Dockerfile`): Python 3.12-slim, pip install, entrypoint runs migrations.
- **Frontend** (`frontend/Dockerfile`): Multi-stage — Node 22-alpine build → nginx 1.27-alpine serve.
- **Local** (`docker/compose.local.yml`): postgres (pgvector/pg16), redis (7-alpine), backend.
- **Prod** (`docker/compose.prod.yml`): Pulls from Alibaba Cloud ACR.

## CI/CD (GitHub Actions)

**CI** (`.github/workflows/ci.yml`, 5 jobs):
1. `frontend-quality` — npm ci → typecheck → lint → build → test
2. `backend-quality` — pip install → ruff → mypy → pytest (skips E2E)
3. `integration` — matrix `AUTH_MODE=legacy|rbac`, needs Redis + PostgreSQL services
4. `docs-check` — verifies `.env.example` covers all env vars; checks module count matches CLAUDE.md
5. `build-frontend` — npm ci → build → uploads `frontend/dist/`

**Deploy** (`.github/workflows/deploy.yml`): Build images (backend, frontend) → push to Alibaba ACR → SSH deploy to `<server-ip>` (set via `REMOTE_HOST` secret in GitHub Actions) with `docker compose -f docker/compose.prod.yml up -d --force-recreate`.

**Release** (`.github/workflows/release.yml`): Triggered by `v*` tags. Tags with `-beta`/`-alpha`/`-rc` → prerelease. Auto-generated release notes.

## Testing quirks

- **Frontend**: jsdom via Vitest. `TestProviders` wrapper for component tests.
- **Backend**: `pytest` with `asyncio_mode=auto`. Fixtures monkey-patch in-memory SQLite. Module-scoped `db_engine`, function-scoped `async_session`.
- **E2E** (`test_e2e_full_flow.py`): Requires Docker (`virtual-team-redis` container). Runs against `localhost:8080`.

## Git & Hooks

- **Pre-push** (`.githooks/pre-push`): Blocks direct pushes to `main`. Activate: `git config core.hooksPath .githooks`.
- **Pre-commit** (`.husky/pre-commit`): `lint-staged` on frontend `*.{ts,tsx,css}` (ESLint fix + Prettier).

## Key constraints

- No `as any` / `@ts-ignore` / `@ts-expect-error` in frontend.
- Frontend coverage thresholds enforced — don't drop.
- Chinese (`zh-CN`) is primary UI language. English translations must stay in sync.
- New modules follow the 9-10 file pattern + register in `WorkstationPage.tsx` and `CLAUDE.md`.
- New repo functions explicitly exported via `repository/__init__.py`.
- Celery tasks must wrap async code in `_run_async(coro)`.
- Backend mypy `--strict` has many module-level `ignore_errors` overrides in `pyproject.toml` — not fully enforced.
