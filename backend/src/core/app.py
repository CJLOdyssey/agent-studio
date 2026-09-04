"""FastAPI 应用入口：应用工厂、中间件、路由注册与错误处理。"""

import importlib
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

# ── 启动守护（必须最先执行 —— 捕获初始化前的崩溃） ──────────────
from observability.startup_guard import mark_starting

mark_starting()

from core.app_lifespan import shutdown, startup
from core.infra.logging_config import get_logger
from routers import (
    admin,
    agent_test_handler,
    agents,
    alert,
    attachments,
    auth,
    commands,
    cost,
    events,
    keys,
    llm_traces,
    mcps,
    models,
    monitor_events,
    preferences,
    prompts,
    providers,
    run_continue,
    runs,
    sessions,
    skills,
    slo,
    team_runs,
    teams,
    tools,
    versions,
    workflows,
)

logger = get_logger(__name__)

def _safe_float(key: str, default: float) -> float:
    try:
        return float(os.environ[key])
    except (KeyError, ValueError, TypeError):
        return default


# ── Sentry APM（必须在 FastAPI 应用之前初始化） ─────────────────────
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    sentry_sdk: Any = importlib.import_module("sentry_sdk")
    FastApiIntegration: Any = importlib.import_module("sentry_sdk.integrations.fastapi").FastApiIntegration
    StarletteIntegration: Any = importlib.import_module("sentry_sdk.integrations.starlette").StarletteIntegration

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "development"),
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
        ],
        traces_sample_rate=_safe_float("SENTRY_TRACES_SAMPLE_RATE", 0.1),
        profiles_sample_rate=_safe_float("SENTRY_PROFILES_SAMPLE_RATE", 0.1),
        send_default_pii=False,
    )
    logger.info("Sentry initialized (environment=%s)", os.environ.get("SENTRY_ENVIRONMENT", "development"))
else:
    logger.info("Sentry DSN not configured — error tracking disabled")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """应用生命周期管理器 —— 运行启动与关闭钩子。"""
    await startup(app)
    yield
    await shutdown(app)


app = FastAPI(
    title="AgentStudio API",
    description="AI Agent 管理平台 API — 支持 Agent 配置、Prompt 管理、工具集成、MCP 协议、技能系统、团队协作",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ── 调试路由 ───────────────────────────────────────────────────────────
from observability import router as debug_router

app.include_router(debug_router)


# ── 中间件（顺序很重要 —— 最外层最先） ────────────────────────────
from core.infra.rate_limit import RateLimitMiddleware

_rate_limit_user_raw = os.environ.get("RATE_LIMIT_USER")
app.add_middleware(
    RateLimitMiddleware,
    rate=int(os.environ.get("RATE_LIMIT", "60")),
    window_seconds=int(os.environ.get("RATE_LIMIT_WINDOW", "60")),
    user_rate=int(_rate_limit_user_raw) if _rate_limit_user_raw else None,
)

from auth import AuthMiddleware

app.add_middleware(AuthMiddleware)

from core.infra.request_logger import RequestLogMiddleware

app.add_middleware(RequestLogMiddleware)

_cors_origins_raw = os.environ.get("CORS_ORIGINS", "")
if _cors_origins_raw:
    _cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]
else:
    # 仅在未显式设置 CORS_ORIGINS 时使用开发默认值
    _cors_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5177",
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
    ]
    _prod_origin = os.environ.get("CORS_ORIGIN")
    if _prod_origin:
        _cors_origins.append(_prod_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-ID", "X-Requested-With", "Accept"],
)

# ── CSP（内容安全策略） ─────────────────────────────────────────
from core.infra.csp_middleware import CSPMiddleware

app.add_middleware(CSPMiddleware)

# ── 安全响应头（X-Content-Type-Options、X-Frame-Options、HSTS） ─────
from core.infra.security_headers_middleware import SecurityHeadersMiddleware

app.add_middleware(SecurityHeadersMiddleware)

# ── 请求体大小限制 ──────────────────────────────────────────────
from core.infra.request_size_middleware import RequestSizeLimitMiddleware

app.add_middleware(RequestSizeLimitMiddleware)


# ── 路由 ─────────────────────────────────────────────────────────────────
routers = [auth, events, runs, run_continue, sessions, agents, agent_test_handler, attachments, commands, models, keys,
           teams, tools, skills, prompts, mcps, admin, providers, versions,
           workflows, team_runs, preferences, cost, alert, monitor_events, llm_traces, slo]
for r in routers:
    app.include_router(r.router)


# ── 异常处理器 ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """处理未捕获异常 —— 记录日志并返回 500 JSON 响应。"""
    logger.error(
        "Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True
    )
    if isinstance(exc, HTTPException):
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误，请查看日志了解详情"},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """处理 HTTP 异常 —— 将 403（角色不足）的尝试持久化到审计记录。

    授权失败是安全相关事件：以 ``level=error`` 记录，使暴力破解 / 提权探测
    在防篡改审计日志中可见。其他状态码原样透传。
    """
    if exc.status_code == 403:
        try:
            from services.audit_service import log_audit

            await log_audit(
                action="access_denied",
                entity_type="system",
                entity_name=request.url.path,
                detail=f"403 越权访问被拒绝: {request.method} {request.url.path}",
                level="error",
            )
        except Exception:  # noqa: BLE001 — 审计写入绝不能中断响应
            logger.exception("Failed to write 403 audit entry for %s", request.url.path)

    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=getattr(exc, "headers", None),
    )


# ── 健康检查 / 指标 / 版本 ─────────────────────────────────────────────


def _get_process_cpu_seconds() -> float | None:
    """返回本进程消耗的总 CPU 秒数（来自 /proc/pid/stat）。

    Linux 以时钟滴答暴露 utime+stime（字段 13-14）与 cutime+cstime（字段 15-16），
    CLK_TCK 几乎恒为 100。
    """
    try:
        with open(f"/proc/{os.getpid()}/stat") as f:
            parts = f.read().split()
        total_ticks = int(parts[13]) + int(parts[14]) + int(parts[15]) + int(parts[16])
        return round(total_ticks / 100, 1)  # Linux 上 CLK_TCK=100
    except Exception:
        return None


def _get_process_mem_mb() -> float | None:
    """返回本进程当前 RSS 内存（MB，来自 /proc/pid/status）。"""
    try:
        with open(f"/proc/{os.getpid()}/status") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    kb = int(line.split()[1])
                    return round(kb / 1024, 1)
        return None
    except Exception:
        return None


@app.get("/api/metrics")
def metrics() -> Any:
    """Prometheus 指标端点。"""
    from core.infra.metrics import metrics_endpoint
    return metrics_endpoint()


@app.get("/api/health")
async def health() -> Any:
    """深度健康检查 —— 校验数据库、Redis 与自身 CPU 状态。"""
    from repository.health import get_enhanced_health

    health_data = await get_enhanced_health()
    cpu_seconds = _get_process_cpu_seconds()

    if cpu_seconds is not None:
        health_data["checks"]["cpu_seconds"] = str(cpu_seconds)

    mem_usage = _get_process_mem_mb()
    if mem_usage is not None:
        health_data["details"]["mem_usage_mb"] = mem_usage
    from core.infra.qps import current_qps

    health_data["details"]["qps"] = current_qps()

    status_code = 200 if health_data["status"] == "healthy" else 503
    return JSONResponse(
        content=health_data,
        status_code=status_code,
    )


@app.get("/api/version")
def version() -> Any:
    """应用版本端点。"""
    return {"version": "0.1.0"}


# ── 主入口 ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    logger.info("Starting uvicorn on 0.0.0.0:%d", port)
    uvicorn.run("backend.core.app:app", host="0.0.0.0", port=port, reload=True)
