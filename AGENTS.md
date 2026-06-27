# AGENTS.md — 虚拟软件外包团队

Multi-repo structure: `frontend/` (React 18 + Vite 6) + `virtual_team/` (FastAPI + SQLAlchemy async).  
Two entrypoints, no monorepo tool. Frontend proxies `/api` to `localhost:8081` in dev (`vite.config.ts`).

## Commands

| Action | Frontend (`frontend/`) | Backend (project root) |
|--------|----------------------|------------------------|
| Dev server | `npm run dev` | `PYTHONPATH=. python3 -m uvicorn virtual_team.app:app --reload` |
| Build | `npm run build` (`tsc -b && vite build`) | — |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | `mypy virtual_team/ --strict` |
| Lint | `npm run lint` (ESLint) | `ruff check virtual_team/` |
| Format | `npm run format` (Prettier) | — (ruff handles) |
| Test (unit) | `npm test` (Vitest) | `PYTHONPATH=. python3 -m pytest virtual_team/ -v --tb=short` |
| Test (e2e) | — | `PYTHONPATH=. AUTH_MODE=legacy CHECKPOINTER_BACKEND=memory python3 -m pytest virtual_team/tests/test_e2e_full_flow.py -v --tb=short` |
| Coverage | `npm run test:coverage` | — |
| CLI | — | `PYTHONPATH=. python3 -m virtual_team.main "<requirement>"` |

**Always use `PYTHONPATH=.`** for backend commands — the project is not installed as a package.  
**Backend Ruff + mypy + pytest all run in CI** — run all three before pushing. Frontend order: `typecheck → lint → build → test` (matching CI).

## Architecture

### Frontend

```
DevAgentsWorkstation.tsx (chat + sidebar + workstation layout)
  └─ WorkstationPage.tsx (10-tab menu → ErrorBoundary per module)
       ├─ agent/, prompt/, output/, tool/, mcp/, skill/, team/  ← CRUD modules
       ├─ monitor/, logs/, settings/                            ← display-only modules
       └─ shared/ (ErrorBoundary, LoadingSkeleton, DeleteConfirmModal, ResourcePickerModal, ...)
  └─ modals/ (AgentConfigModal + tabs: SystemPrompt, OutputConstraint, Tools, MCP, Skills)
```

**Module file convention** (each CRUD module in its own directory):
```
Management.tsx + FormModal.tsx + types.ts + constants.ts + mock-data.ts + api.ts + locales.ts + useXxxData.ts + useXxxUI.ts + index.ts
```
Always import via `index.ts` barrel exports, never from internal files directly.

**DI pattern**: Each workstation module's `api.ts` exports `let xxxAPI: XxxService = realImpl` plus a `setXxxAPI(mock)` for tests. Components import from the module's `api.ts` re-exported via `index.ts`. Test code can swap implementations via `setXxxAPI()`.

**State split**: Zustand `chatStore.ts` for UI/chat state. TanStack Query for server data (via hooks in `api/hooks.ts`). Each workstation module has `useXxxData` (data+CRUD+error+retry) + `useXxxUI` (sort/filter/selection/modal state) hooks.

**i18n**: i18next with `zh-CN` fallback. Global keys in `src/i18n/locales/{zh-CN,en-US}.json`. Module-specific keys in each module's `locales.ts` (tuple format with `t()` function). Use `useTranslation()` from react-i18next in components or `t()` from module locales.

**CSS**: 15 CSS files in `src/styles/` — `tokens.css` (design tokens), `layout.css`, per-module files (`workstation-*.css`). Not CSS modules — plain CSS with `.wsta-*` prefix convention.

**Coverage thresholds** (enforced): statements 30%, branches 19%, functions 20%, lines 30%.

**TypeScript**: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. No `as any` / `@ts-ignore` / `@ts-expect-error` anywhere.

### Backend

```
app.py (FastAPI lifespan, middleware stack: RateLimit → Auth → CORS)
  └─ routers/ (14 modules: admin, agents, attachments, commands, keys, mcps, models, prompts, runs,
  │            sessions, skills, system_team, teams, tools)
  │    └─ repository/ (8 modules: core, agents, keys, teams, prompts, tools, mcps, skills)
  │         └─ database.py (18 ORM models)
  └─ checkpoint.py (CheckpointDB model + create_checkpointer factory)
```

**Three-layer strict**: `database.py` (ORM models) → `repository/` (async queries) → `routers/` (HTTP endpoints). Routers never touch database.py directly.

**Star-import barrel**: `virtual_team/repository/__init__.py` uses star imports from all repository modules — any new repository function is available via `from virtual_team.repository import *`.

**Two graph engines**:
- `agent_graph.py` — LangGraph **single-agent** engine (`SingleAgentGraph`). Key classes: `ToolConfig` (lightweight tool descriptor), `_ToolWrapper` (invocation wrapper with built-in handlers: calculator/weather/websearch, MCP handlers, LLM fallback). Tool name prefix convention: raw tools get original name, MCP gets `mcp_{name}`, skills get `skill_{name}`.
- `team_graph.py` — LangGraph **multi-agent** collaboration (`TeamGraph`). PM → Frontend → Backend → Tester loop with up to `max_rounds` iterations.

**Task execution** (`tasks.py`): Celery tasks parse agent config JSON fields (tools, mcp, skills), look up `registered_tools`/`mcp_servers`/`registered_skills` from DB, create `ToolConfig` objects, bind to graph, then execute. Uses `asyncio.run()` internally.

**Config loading**: `config.py` reads `.env` file at startup (manually, not python-dotenv) — env vars take precedence. Loaded via `load_config()` in FastAPI lifespan.

**Checkpointer**: `checkpoint.py` `create_checkpointer()` — currently always returns `MemorySaver`. `CHECKPOINTER_BACKEND=sqlite|memory|postgres` supported in code but only memory is wired. `CHECKPOINTER_DSN` reserved for future.

**Auth**: Two modes via `AUTH_MODE`:
- `legacy` (default): fixed admin user, no DB query
- `rbac`: JWT (HS256) + `UserDB`/`RoleDB`/`UserRoleDB` lookup. `AUTH_ENABLED=1` required for enforcement.
`get_current_user` is a FastAPI `Depends` callable returning `CurrentUser` dataclass. `require_role(*names)` is a dependency factory.

**Error codes**: `ErrorCode` enum in `error_codes.py` (23 codes). Format `{MODULE}_3DIGIT`, e.g. `TEAM_001`. Use `error_response(ErrorCode.TEAM_001, detail="...")` to return structured errors. Conflicts mapped to HTTP 409, auth errors to 401/403, rate limiting to 429.

**Team name uniqueness**: Enforced at DB level (`teams.name` UNIQUE + INDEX) and repository level → router returns 409.

**Rate limiting**: Token-bucket backed by Redis (`RateLimitMiddleware`). Default 60 req / 60s per IP.

## Database

19 tables across models (18 in `database.py` + 1 `checkpoints` in `checkpoint.py`). Key foreign key chains:
```
sessions (1) → project_runs (N) → chat_messages (N)
sessions (1) → memory_entries (N) → checkpoints (N)
agent_configs (1) → team_agents (N) ← teams (1)
user_api_keys (1) → key_usage_logs (N)
users (1) → user_roles (N) ← roles (1)
```

Env var `DATABASE_URL` defaults to `postgresql+asyncpg://postgres:postgres@localhost:5432/virtual_team`.

## CLI

`python3 -m virtual_team.main "<requirement>"` runs a single agent via LangGraph from the command line. Reads `DEEPSEEK_API_KEY`/`OPENAI_API_KEY` from env or `.env`. Uses first active agent config's system prompt.

## CI/CD (GitHub Actions)

5 jobs in `.github/workflows/ci.yml`, all must pass:
1. `frontend-quality` — `npm ci → typecheck → lint → build → test`
2. `backend-quality` — `pip install → ruff → mypy → pytest`
3. `integration` — Matrix on `AUTH_MODE=legacy|rbac` with `CHECKPOINTER_BACKEND=memory`
4. `docs-check` — Verifies `.env.example` covers all env vars in code; checks table count matches CLAUDE.md
5. `build-frontend` — Separate `npm ci → build` + uploads `frontend/dist/` as artifact

## Testing Quirks

- **Frontend**: Vitest with jsdom. Setup in `src/test/setup.tsx` — wraps in `TestProviders` (QueryClient + SettingsProvider + ToastProvider). `scrollIntoView` mocked globally.
- **Backend**: `pytest` with `asyncio_mode=auto`. Fixtures in `conftest.py` — monkey-patches in-memory SQLite engine. Module-scoped `db_engine`, function-scoped `async_session`.
- **E2E test** (`test_e2e_full_flow.py`): Requires **Docker** (`virtual-team-redis` container) for Redis rate-limit flushing. Runs against `localhost:8080`. See `.github/workflows/ci.yml` for exact runner env.
- **Pre-existing failures**: `test_conversation.py` has 2 known failures related to `StreamEmitter._pending_thinking` — not related to most changes.

## Key Constraints

- **No `as any` / `@ts-ignore` / `@ts-expect-error`** anywhere in frontend.
- **Frontend coverage thresholds are low but enforced** — don't drop below current values.
- **Chinese is the primary UI language** (`zh-CN` fallback in i18next). English translations must be kept in sync.
- **New modules must follow the 10-file pattern** and be registered in `WorkstationPage.tsx` tabs and `CLAUDE.md`.
- **`repository/__init__.py`** re-exports all functions via star imports — any new repository function is automatically available via `from virtual_team.repository import *`.
- **`tasks.py`** is Celery-based but uses `asyncio.run()` internally — async functions must be wrapped in `_run_async`.
- **Docker** is used in CI and for Redis in E2E tests (not for local dev server).
