"""Unit tests for virtual_team/app.py (FastAPI app initialization)."""






class TestAppCreation:
    """Test FastAPI app creation: route count, CORS, routers, lifespan."""

    def test_app_import(self):
        import virtual_team.app

        assert virtual_team.app.app is not None

    def test_app_title(self):
        from virtual_team.app import app

        assert app.title == "AgentStudio"

    def test_app_route_count(self):
        from virtual_team.app import app

        assert len(app.routes) >= 80

    def test_app_has_health_endpoint(self):
        from virtual_team.app import app

        paths = [r.path for r in app.routes if hasattr(r, "path")]
        assert "/api/health" in paths

    def test_app_has_metrics_endpoint(self):
        from virtual_team.app import app

        paths = [r.path for r in app.routes if hasattr(r, "path")]
        assert "/api/metrics" in paths

    def test_app_has_version_endpoint(self):
        from virtual_team.app import app

        paths = [r.path for r in app.routes if hasattr(r, "path")]
        assert "/api/version" in paths

    def test_cors_middleware_registered(self):
        from fastapi.middleware.cors import CORSMiddleware

        from virtual_team.app import app

        middleware_types = [m.cls for m in app.user_middleware]
        assert CORSMiddleware in middleware_types

    def test_cors_origins_include_localhost(self):
        from virtual_team.app import app

        for m in app.user_middleware:
            if m.cls.__name__ == "CORSMiddleware":
                assert "http://localhost:5173" in m.kwargs["allow_origins"]
                assert "http://localhost:8080" in m.kwargs["allow_origins"]

    def test_auth_middleware_registered(self):
        from virtual_team.app import app
        from virtual_team.auth import AuthMiddleware

        middleware_types = [m.cls for m in app.user_middleware]
        assert AuthMiddleware in middleware_types

    def test_rate_limit_middleware_registered(self):
        from virtual_team.app import app
        from virtual_team.rate_limit import RateLimitMiddleware

        middleware_types = [m.cls for m in app.user_middleware]
        assert RateLimitMiddleware in middleware_types

    def test_request_log_middleware_registered(self):
        from virtual_team.app import app
        from virtual_team.request_logger import RequestLogMiddleware

        middleware_types = [m.cls for m in app.user_middleware]
        assert RequestLogMiddleware in middleware_types

    def test_key_routes_exist(self):
        from virtual_team.app import app

        paths = {r.path for r in app.routes if hasattr(r, "path")}
        assert "/api/keys" in paths

    def test_session_routes_exist(self):
        from virtual_team.app import app

        paths = {r.path for r in app.routes if hasattr(r, "path")}
        assert any("/api/sessions" in p for p in paths)

    def test_lifespan_is_attached(self):
        from virtual_team.app import app

        assert app.router.lifespan_context is not None

    def test_global_exception_handler_exists(self):
        from virtual_team.app import app

        assert len(app.exception_handlers) > 0

    def test_all_routers_are_included(self):
        from virtual_team.app import app

        router_paths = set()
        for route in app.routes:
            if hasattr(route, "path"):
                router_paths.add(route.path)

        assert len(router_paths) >= 20


# ─────────────────────────────────────────────────────────────────────
# 12. virtual_team/repository/base.py + deps.py — CRUD patterns
# ─────────────────────────────────────────────────────────────────────


