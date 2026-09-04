"""PermissionMiddleware / decorators / checker 单元测试"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, Request, status

from organization.audit_logger import AuditAction, AuditLogger, AuditSeverity
from organization.permission_middleware import (
    AuditMiddleware,
    PermissionChecker,
    PermissionMiddleware,
    require_all_permissions,
    require_any_permission,
    require_permission,
)
from organization.role_manager import Permission, RoleManager


@pytest.fixture
def role_manager() -> RoleManager:
    return RoleManager()


@pytest.fixture
def audit_logger() -> AuditLogger:
    return AuditLogger()


def _make_request(
    path: str = "/test",
    method: str = "GET",
    user_id: str | None = None,
    query_user_id: str | None = None,
) -> Request:
    request = MagicMock(spec=Request)
    request.url = MagicMock()
    request.url.path = path
    request.method = method
    headers: dict[str, str] = {}
    if user_id:
        headers["X-User-ID"] = user_id
    request.headers = headers
    request.query_params = {"user_id": query_user_id} if query_user_id else {}
    request.client = MagicMock()
    request.client.host = "127.0.0.1"
    return request


# --- PermissionMiddleware ---

class TestPermissionMiddleware:
    @pytest.mark.asyncio
    async def test_no_user_passthrough(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        request = _make_request()
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        resp = await mw(request, call_next)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_user_success(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        request = _make_request(user_id="u1")
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        resp = await mw(request, call_next)
        assert resp.status_code == 200
        assert len(audit_logger.logs) == 1
        assert audit_logger.logs[0].success is True

    @pytest.mark.asyncio
    async def test_http_exception(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        request = _make_request(user_id="u1")
        call_next = AsyncMock(side_effect=HTTPException(status_code=403, detail="denied"))
        with pytest.raises(HTTPException):
            await mw(request, call_next)
        assert len(audit_logger.logs) == 1
        assert audit_logger.logs[0].success is False

    @pytest.mark.asyncio
    async def test_generic_exception(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        request = _make_request(user_id="u1")
        call_next = AsyncMock(side_effect=RuntimeError("boom"))
        with pytest.raises(RuntimeError):
            await mw(request, call_next)
        assert audit_logger.logs[0].severity == AuditSeverity.ERROR


class TestGetUserId:
    def test_header_preferred(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        req = _make_request(user_id="u1")
        assert mw._get_user_id(req) == "u1"

    def test_query_param(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        req = _make_request(query_user_id="u2")
        assert mw._get_user_id(req) == "u2"

    def test_none(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        assert mw._get_user_id(_make_request()) is None


class TestLogRequest:
    def test_action_mapping(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        for method, expected in [
            ("GET", AuditAction.WORKFLOW_EXECUTE),
            ("POST", AuditAction.WORKFLOW_CREATE),
            ("PUT", AuditAction.WORKFLOW_UPDATE),
            ("DELETE", AuditAction.WORKFLOW_DELETE),
            ("PATCH", AuditAction.WORKFLOW_EXECUTE),
        ]:
            mw._log_request(_make_request(method=method), "u1", success=True)
            assert audit_logger.logs[-1].action == expected

    def test_no_client(self, audit_logger: AuditLogger, role_manager: RoleManager) -> None:
        mw = PermissionMiddleware(role_manager, audit_logger)
        req = _make_request()
        req.client = None
        mw._log_request(req, "u1", success=True)
        assert audit_logger.logs[-1].ip_address == ""


# --- Decorators ---

class TestRequirePermission:
    @pytest.mark.asyncio
    async def test_no_user_401(self, role_manager: RoleManager) -> None:
        @require_permission(Permission.DATA_READ, role_manager)
        async def func() -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func()
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_no_permission_403(self, role_manager: RoleManager) -> None:
        @require_permission(Permission.SYSTEM_ADMIN, role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func(user_id="u1")
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_has_permission(self, role_manager: RoleManager) -> None:
        role_manager.assign_role("u1", "super_admin")

        @require_permission(Permission.SYSTEM_ADMIN, role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        result = await func(user_id="u1")
        assert result == "ok"

    @pytest.mark.asyncio
    async def test_denial_logs_audit(self, role_manager: RoleManager, audit_logger: AuditLogger) -> None:
        @require_permission(Permission.SYSTEM_ADMIN, role_manager, audit_logger)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        with pytest.raises(HTTPException):
            await func(user_id="u1")
        assert len(audit_logger.logs) == 1


class TestRequireAnyPermission:
    @pytest.mark.asyncio
    async def test_no_user_401(self, role_manager: RoleManager) -> None:
        @require_any_permission([Permission.DATA_READ], role_manager)
        async def func() -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func()
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_none_match_403(self, role_manager: RoleManager) -> None:
        @require_any_permission([Permission.SYSTEM_ADMIN, Permission.DATA_DELETE], role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func(user_id="u1")
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_one_match(self, role_manager: RoleManager) -> None:
        role_manager.assign_role("u1", "user")

        @require_any_permission([Permission.SYSTEM_ADMIN, Permission.WORKFLOW_READ], role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        assert await func(user_id="u1") == "ok"


class TestRequireAllPermissions:
    @pytest.mark.asyncio
    async def test_no_user_401(self, role_manager: RoleManager) -> None:
        @require_all_permissions([Permission.DATA_READ], role_manager)
        async def func() -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func()
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_not_all_403(self, role_manager: RoleManager) -> None:
        role_manager.assign_role("u1", "user")

        @require_all_permissions([Permission.WORKFLOW_READ, Permission.SYSTEM_ADMIN], role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        with pytest.raises(HTTPException) as exc_info:
            await func(user_id="u1")
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_all_match(self, role_manager: RoleManager) -> None:
        role_manager.assign_role("u1", "super_admin")

        @require_all_permissions([Permission.SYSTEM_ADMIN, Permission.DATA_WRITE], role_manager)
        async def func(user_id: str = "u1") -> str:
            return "ok"

        assert await func(user_id="u1") == "ok"


# --- PermissionChecker ---

class TestPermissionChecker:
    @pytest.mark.asyncio
    async def test_has_permission(self, role_manager: RoleManager) -> None:
        role_manager.assign_role("u1", "super_admin")
        checker = PermissionChecker(Permission.SYSTEM_ADMIN, role_manager)
        assert await checker("u1") is True

    @pytest.mark.asyncio
    async def test_no_permission_403(self, role_manager: RoleManager) -> None:
        checker = PermissionChecker(Permission.SYSTEM_ADMIN, role_manager)
        with pytest.raises(HTTPException) as exc_info:
            await checker("u1")
        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN


# --- AuditMiddleware ---

class TestAuditMiddleware:
    @pytest.mark.asyncio
    async def test_success(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        request = _make_request(method="POST", path="/workflow/run")
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        resp = await mw(request, call_next)
        assert resp.status_code == 200
        assert len(audit_logger.logs) == 1
        assert audit_logger.logs[0].success is True

    @pytest.mark.asyncio
    async def test_exception(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        request = _make_request()
        call_next = AsyncMock(side_effect=RuntimeError("err"))
        with pytest.raises(RuntimeError):
            await mw(request, call_next)
        assert audit_logger.logs[0].success is False
        assert audit_logger.logs[0].severity == AuditSeverity.ERROR

    @pytest.mark.asyncio
    async def test_anonymous_user(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        request = _make_request()
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        await mw(request, call_next)
        assert audit_logger.logs[0].user_id == "anonymous"

    @pytest.mark.asyncio
    async def test_no_client(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        request = _make_request()
        request.client = None
        call_next = AsyncMock(return_value=MagicMock(status_code=200))
        await mw(request, call_next)


class TestMapAction:
    def test_workflow_post(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        assert mw._map_action("POST", "/workflow/create") == AuditAction.WORKFLOW_CREATE

    def test_agent_put(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        assert mw._map_action("PUT", "/agent/update") == AuditAction.AGENT_UPDATE

    def test_org_delete(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        assert mw._map_action("DELETE", "/org/remove") == AuditAction.ORG_NODE_DELETE

    def test_role_post(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        assert mw._map_action("POST", "/role/create") == AuditAction.ROLE_CREATE

    def test_unknown_path(self, audit_logger: AuditLogger) -> None:
        mw = AuditMiddleware(audit_logger)
        assert mw._map_action("GET", "/unknown") == AuditAction.SYSTEM_CONFIG_UPDATE
