"""Shared helpers for 01-01 Agent Config repository tests."""
from unittest.mock import AsyncMock, MagicMock


def make_mock_session(rows=None, scalar_one=None):
    """Create (factory_mock, session_mock) pair for get_session_factory patching.

    Usage::

        @pytest.fixture(autouse=True)
        def _patch_factory():
            factory, session = make_mock_session()
            with patch("virtual_team.repository.agents.get_session_factory", factory):
                yield session
    """
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_scalar = MagicMock()
    mock_scalar.all.return_value = rows or []
    mock_result.scalars.return_value = mock_scalar
    mock_result.scalar_one_or_none.return_value = scalar_one
    mock_result.rowcount = len(rows) if rows else 0
    mock_session.execute.return_value = mock_result
    mock_session.get.return_value = None
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.delete = AsyncMock()

    class _Ctx:
        def __call__(self):
            return self

        async def __aenter__(self):
            return mock_session

        async def __aexit__(self, *args):
            pass

    return MagicMock(return_value=_Ctx()), mock_session
