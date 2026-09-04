"""在受保护路由上校验 JWT token 的 FastAPI 中间件。"""

from typing import Any, cast

from fastapi import Request
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

from auth.auth_jwt import AUTH_SECRET, decode_jwt
from auth.auth_rbac import AUTH_ENABLED, AUTH_REQUIRE_LOGIN, PUBLIC_PATHS, PUBLIC_PREFIXES
from core.infra.logging_config import get_logger

logger = get_logger(__name__)


async def get_current_user(request: Request) -> dict[str, Any]:
    """从请求状态获取当前用户的 FastAPI 依赖。

    返回 AuthMiddleware 设置的含用户信息的字典。
    未认证则抛出 401。
    """
    from fastapi import HTTPException, status

    if not getattr(request.state, "is_authenticated", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return {
        "user_id": getattr(request.state, "user_id", "unknown"),
        "is_authenticated": True,
    }


class AuthMiddleware(BaseHTTPMiddleware):
    """在受保护路由上校验 JWT token 的 FastAPI 中间件。"""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """校验入站请求的 JWT token。"""
        # 公开路径跳过认证
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return cast(Response, await call_next(request))

        # 未启用认证则跳过
        if not AUTH_ENABLED:
            return cast(Response, await call_next(request))

        # 从 Authorization 响应头、查询参数或 httpOnly cookie 提取 token
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        elif "?" in str(request.url) and "token=" in str(request.url):
            # 同时支持为 WebSocket 提供查询参数
            from urllib.parse import parse_qs

            token = parse_qs(str(request.url.query)).get("token", [""])[0]
        else:
            # Frontend 认证走 httpOnly access_token cookie — 同样参与用户校验，
            # 否则 get_user_id 的 cookie 回退分支会绕过 sub 有效性检查。
            token = request.cookies.get("access_token", "")

        client_ip = request.client.host if request.client else "?"
        user_agent = request.headers.get("user-agent", "")[:255]
        request_id = str(getattr(request.state, "request_id", "") or "")

        # 本请求的审计身份 —— 一旦得知用户即填充，使 log_audit 调用点无需传递请求上下文。
        from services.audit_service import set_audit_context

        set_audit_context(
            client_ip=client_ip, user_agent=user_agent, request_id=request_id
        )

        # ── Guest 模式：无 token → 以未认证状态放行 ────
        # AUTH_REQUIRE_LOGIN=1 将 guest 命名空间变成登录墙：
        # 业务 API 拒绝未认证请求（401），使公开部署可在使用前强制登录。没有登录墙时，
        # 匿名列表端点返回 200 []，前端在短暂认证空档期的重新拉取会清空缓存列表
        # （如会话列表）。
        if not token:
            request.state.is_authenticated = False
            if AUTH_REQUIRE_LOGIN:
                from fastapi.responses import JSONResponse

                logger.warning("Login wall rejected anonymous request | path=%s", path)
                return JSONResponse(
                    status_code=401,
                    content={
                        "detail": {
                            "error": {"code": "AUTH_001", "message": "未登录或会话已过期"}
                        }
                    },
                )
            return cast(Response, await call_next(request))

        payload = decode_jwt(token, AUTH_SECRET)
        if payload is None:
            logger.warning(
                "Auth token rejected | client=%s | path=%s",
                client_ip, path,
            )
            request.state.is_authenticated = False
            # 登录墙：无效/过期 token 与无 token 同等对待 → 401（前端拦截器
            # 自动 refresh 恢复后重试，而非放行 anonymous 返回空列表覆盖缓存）。
            if AUTH_REQUIRE_LOGIN:
                from fastapi.responses import JSONResponse

                logger.warning("Login wall rejected expired token | path=%s", path)
                return JSONResponse(
                    status_code=401,
                    content={
                        "detail": {
                            "error": {"code": "AUTH_001", "message": "未登录或会话已过期"}
                        }
                    },
                )
            return cast(Response, await call_next(request))

        user_id = payload.get("sub", "unknown")
        user = None
        # 校验用户仍存在：用户合并/删除后旧 JWT 的 sub 已失效，继续信任会让
        # key/附件等按 user 归属的解析命中不存在的用户，产生误导性 400。
        if user_id != "unknown":
            try:
                from repository.auth import get_user_by_id

                user = await get_user_by_id(user_id)
            except Exception:
                user = None
            if user is None:
                logger.warning(
                    "Auth token user not found | user_id=%s | client=%s | path=%s",
                    user_id, client_ip, path,
                )
                request.state.user_invalid_token = True
                request.state.is_authenticated = False
                return cast(Response, await call_next(request))

        # 将用户信息挂载到请求状态
        request.state.user_id = user_id
        request.state.is_authenticated = True
        from services.audit_service import set_audit_context

        set_audit_context(
            user_name=user.username if user is not None else "",
            client_ip=client_ip,
            user_agent=request.headers.get("user-agent", "")[:255],
            request_id=str(getattr(request.state, "request_id", "") or ""),
        )

        return cast(Response, await call_next(request))
