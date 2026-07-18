"""FastAPI application entry point: app factory, middleware, router registration, and error handling."""

import os
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Startup guard (must be first — catches pre-init crashes) ──────────────
from virtual_team.observability.startup_guard import mark_starting

mark_starting()

from virtual_team.core.app_lifespan import shutdown, startup  # noqa: E402
from virtual_team.core.infra.logging_config import get_logger  # noqa: E402
from virtual_team.routers import (  # noqa: E402
    admin,
    agent_test_handler,
    agents,
    attachments,
    auth,
    commands,
    keys,
    mcps,
    models,
    prompts,
    providers,
    run_continue,
    runs,
    sessions,
    skills,
    teams,
    tools,
    versions,
    workflows,
)

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager — runs startup and shutdown hooks."""
    await startup(app)
    yield
    await shutdown(app)


app = FastAPI(title="AgentStudio", lifespan=lifespan)


# ── Debug routes ───────────────────────────────────────────────────────────
from virtual_team.observability import router as debug_router  # noqa: E402

app.include_router(debug_router)


# ── Middleware (order matters — outermost first) ────────────────────────────
from virtual_team.core.infra.rate_limit import RateLimitMiddleware  # noqa: E402

app.add_middleware(
    RateLimitMiddleware,
    rate=int(os.environ.get("RATE_LIMIT", "60")),
    window_seconds=int(os.environ.get("RATE_LIMIT_WINDOW", "60")),
)

from virtual_team.auth import AuthMiddleware  # noqa: E402

app.add_middleware(AuthMiddleware)

from virtual_team.core.infra.request_logger import RequestLogMiddleware  # noqa: E402

app.add_middleware(RequestLogMiddleware)

_cors_origins = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
]
_prod_origin = os.environ.get("CORS_ORIGIN")
if _prod_origin:
    _cors_origins.append(_prod_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routers ─────────────────────────────────────────────────────────────────
routers = [auth, runs, run_continue, sessions, agents, agent_test_handler, attachments, commands, models, keys,
           teams, tools, skills, prompts, mcps, admin, providers, versions,
           workflows]
for r in routers:
    app.include_router(r.router)


# ── Exception handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle uncaught exceptions — log and return 500 JSON response."""
    logger.error(
        "Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True
    )
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请查看日志了解详情"},
    )


# ── Health / Metrics / Version ─────────────────────────────────────────────
@app.get("/api/metrics")
def metrics() -> Any:
    """Prometheus metrics endpoint."""
    from virtual_team.core.infra.metrics import metrics_endpoint
    return metrics_endpoint()


@app.get("/api/health")
async def health() -> Any:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/version")
async def version() -> Any:
    """Application version endpoint."""
    return {"version": "0.1.0"}


# ── Main ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    logger.info("Starting uvicorn on 0.0.0.0:%d", port)
    uvicorn.run("virtual_team.app:app", host="0.0.0.0", port=port, reload=True)
