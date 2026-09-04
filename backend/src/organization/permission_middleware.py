"""权限验证中间件 - Permission Verification Middleware

实现权限验证中间件，包括：
- FastAPI中间件
- 权限检查装饰器
- 权限异常处理
"""

from collections.abc import Callable
from datetime import datetime
from functools import wraps
from typing import Any

from fastapi import HTTPException, Request, status

from organization.audit_logger import AuditAction, AuditLogger, AuditSeverity
from organization.role_manager import Permission, RoleManager


class PermissionMiddleware:
    """权限验证中间件"""

    def __init__(
        self,
        role_manager: RoleManager,
        audit_logger: AuditLogger,
    ):
        self.role_manager = role_manager
        self.audit_logger = audit_logger

    async def __call__(self, request: Request, call_next: Callable[[Request], Any]) -> Any:
        """中间件调用"""
        # 获取用户信息
        user_id = self._get_user_id(request)

        if not user_id:
            # 没有用户信息，允许匿名访问（某些公开端点）
            return await call_next(request)

        # 记录请求开始
        start_time = datetime.now()

        try:
            # 执行请求
            response = await call_next(request)

            # 记录成功审计日志
            self._log_request(
                request=request,
                user_id=user_id,
                success=True,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
            )

            return response

        except HTTPException as e:
            # 记录失败的审计日志
            self._log_request(
                request=request,
                user_id=user_id,
                success=False,
                error_message=str(e.detail),
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
            )
            raise

        except Exception as e:
            # 记录异常审计日志
            self._log_request(
                request=request,
                user_id=user_id,
                success=False,
                error_message=str(e),
                severity=AuditSeverity.ERROR,
                duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
            )
            raise

    def _get_user_id(self, request: Request) -> str | None:
        """从请求中获取用户ID"""
        # 从header获取
        user_id = request.headers.get("X-User-ID")
        if user_id:
            return user_id

        # 从query参数获取
        user_id = request.query_params.get("user_id")
        if user_id:
            return user_id

        return None

    def _log_request(
        self,
        request: Request,
        user_id: str,
        success: bool,
        error_message: str = "",
        severity: AuditSeverity = AuditSeverity.INFO,
        duration_ms: float = 0,
    ) -> None:
        """记录请求审计日志"""
        # 映射HTTP方法到审计操作
        action_map = {
            "GET": AuditAction.WORKFLOW_EXECUTE,  # 默认，实际会根据资源类型调整
            "POST": AuditAction.WORKFLOW_CREATE,
            "PUT": AuditAction.WORKFLOW_UPDATE,
            "DELETE": AuditAction.WORKFLOW_DELETE,
        }

        action = action_map.get(request.method, AuditAction.WORKFLOW_EXECUTE)

        self.audit_logger.log(
            action=action,
            user_id=user_id,
            resource_type="api_request",
            resource_id=request.url.path,
            description=f"{request.method} {request.url.path}",
            details={
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "duration_ms": duration_ms,
            },
            severity=severity,
            success=success,
            error_message=error_message,
            ip_address=request.client.host if request.client else "",
            user_agent=request.headers.get("user-agent", ""),
        )


def require_permission(
    permission: Permission,
    role_manager: RoleManager,
    audit_logger: AuditLogger | None = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """权限检查装饰器"""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # 获取用户ID（从kwargs或args中）
            user_id = kwargs.get("user_id") or (args[0] if args else None)

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User ID is required",
                )

            # 检查权限
            if not role_manager.has_permission(user_id, permission):
                # 记录权限拒绝
                if audit_logger:
                    audit_logger.log(
                        action=AuditAction.ROLE_ASSIGN,  # 使用相关操作
                        user_id=user_id,
                        resource_type="permission_check",
                        resource_id=permission.value,
                        description=f"权限检查失败: {permission.value}",
                        severity=AuditSeverity.WARNING,
                        success=False,
                        error_message=f"缺少权限: {permission.value}",
                    )

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {permission.value}",
                )

            # 执行函数
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_any_permission(
    permissions: list[Permission],
    role_manager: RoleManager,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """检查是否有任一权限"""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            user_id = kwargs.get("user_id") or (args[0] if args else None)

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User ID is required",
                )

            if not role_manager.has_any_permission(user_id, permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: requires any of {[p.value for p in permissions]}",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_all_permissions(
    permissions: list[Permission],
    role_manager: RoleManager,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """检查是否有所有权限"""

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            user_id = kwargs.get("user_id") or (args[0] if args else None)

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User ID is required",
                )

            if not role_manager.has_all_permissions(user_id, permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: requires all of {[p.value for p in permissions]}",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


class PermissionChecker:
    """权限检查器（用于依赖注入）"""

    def __init__(
        self,
        required_permission: Permission,
        role_manager: RoleManager,
    ):
        self.required_permission = required_permission
        self.role_manager = role_manager

    async def __call__(self, user_id: str) -> bool:
        """检查权限"""
        if not self.role_manager.has_permission(user_id, self.required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {self.required_permission.value}",
            )
        return True


class AuditMiddleware:
    """审计中间件（独立于权限检查）"""

    def __init__(self, audit_logger: AuditLogger):
        self.audit_logger = audit_logger

    async def __call__(self, request: Request, call_next: Callable[[Request], Any]) -> Any:
        """中间件调用"""
        user_id = request.headers.get("X-User-ID", "anonymous")
        start_time = datetime.now()

        try:
            response = await call_next(request)

            # 记录成功的API调用
            self.audit_logger.log(
                action=self._map_action(request.method, request.url.path),
                user_id=user_id,
                resource_type="api",
                resource_id=request.url.path,
                description=f"{request.method} {request.url.path}",
                details={
                    "status_code": response.status_code,
                    "duration_ms": (datetime.now() - start_time).total_seconds() * 1000,
                },
                success=True,
                ip_address=request.client.host if request.client else "",
            )

            return response

        except Exception as e:
            # 记录失败的API调用
            self.audit_logger.log(
                action=self._map_action(request.method, request.url.path),
                user_id=user_id,
                resource_type="api",
                resource_id=request.url.path,
                description=f"{request.method} {request.url.path} - Error",
                details={
                    "error": str(e),
                    "duration_ms": (datetime.now() - start_time).total_seconds() * 1000,
                },
                success=False,
                error_message=str(e),
                severity=AuditSeverity.ERROR,
                ip_address=request.client.host if request.client else "",
            )
            raise

    def _map_action(self, method: str, path: str) -> AuditAction:
        """映射HTTP请求到审计操作"""
        # 路径到资源类型的映射
        path_mapping = {
            "/workflow": {
                "POST": AuditAction.WORKFLOW_CREATE,
                "PUT": AuditAction.WORKFLOW_UPDATE,
                "DELETE": AuditAction.WORKFLOW_DELETE,
            },
            "/agent": {
                "POST": AuditAction.AGENT_CREATE,
                "PUT": AuditAction.AGENT_UPDATE,
                "DELETE": AuditAction.AGENT_DELETE,
            },
            "/org": {
                "POST": AuditAction.ORG_NODE_CREATE,
                "PUT": AuditAction.ORG_NODE_UPDATE,
                "DELETE": AuditAction.ORG_NODE_DELETE,
            },
            "/role": {
                "POST": AuditAction.ROLE_CREATE,
                "PUT": AuditAction.ROLE_UPDATE,
                "DELETE": AuditAction.ROLE_DELETE,
            },
        }

        # 根据路径判断资源类型
        for path_key, method_mapping in path_mapping.items():
            if path_key in path:
                return method_mapping.get(method, AuditAction.WORKFLOW_EXECUTE)

        # 默认
        return AuditAction.SYSTEM_CONFIG_UPDATE
