"""Repository 层测试：virtual_team.repository.schemas"""
from unittest.mock import MagicMock, patch

import pytest

from tests.unit.repository.conftest import make_mock_session


def _make_schema(id="s1", agent_id="agent-1", name="prd_template",
                 format_type="markdown", schema_def='{"type":"object"}',
                 example="# PRD"):
    m = MagicMock()
    m.id = id
    m.agent_id = agent_id
    m.name = name
    m.format_type = format_type
    m.schema_def = schema_def
    m.example = example
    return m


@pytest.fixture(autouse=True)
def _patch_factory():
    factory, session = make_mock_session()
    with patch("virtual_team.repository.schemas.get_session_factory", factory):
        yield session


class TestCreateOutputSchema:
    @pytest.mark.asyncio
    async def test_creates_all_fields(self, _patch_factory):
        from virtual_team.repository.schemas import create_output_schema
        result = await create_output_schema(
            "agent-1", "prd_template", "markdown",
            '{"type":"object"}', example="# PRD",
        )
        assert result.agent_id == "agent-1"
        assert result.name == "prd_template"
        assert result.format_type == "markdown"
        assert result.schema_def == '{"type":"object"}'
        assert result.example == "# PRD"
        _patch_factory.add.assert_called_once()
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_creates_without_optional_example(self, _patch_factory):
        from virtual_team.repository.schemas import create_output_schema
        result = await create_output_schema("agent-1", "req", "json", '{"type":"object"}')
        assert result.example is None


class TestGetOutputSchemas:
    @pytest.mark.asyncio
    async def test_empty(self, _patch_factory):
        from virtual_team.repository.schemas import get_output_schemas
        result = await get_output_schemas("agent-1")
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_all(self, _patch_factory):
        schemas = [_make_schema(id="s1"), _make_schema(id="s2")]
        _patch_factory.execute.return_value.scalars.return_value.all.return_value = schemas
        from virtual_team.repository.schemas import get_output_schemas
        result = await get_output_schemas("agent-1")
        assert len(result) == 2


class TestGetOutputSchema:
    @pytest.mark.asyncio
    async def test_found(self, _patch_factory):
        schema = _make_schema(id="s1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = schema
        from virtual_team.repository.schemas import get_output_schema
        result = await get_output_schema("s1")
        assert result is schema

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        from virtual_team.repository.schemas import get_output_schema
        result = await get_output_schema("nonexistent")
        assert result is None


class TestUpdateOutputSchema:
    @pytest.mark.asyncio
    async def test_updates_all_fields(self, _patch_factory):
        schema = _make_schema(id="s1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = schema
        from virtual_team.repository.schemas import update_output_schema
        result = await update_output_schema(
            "s1", name="new_name", format_type="json",
            schema_def='{"type":"array"}', example="[]",
        )
        assert result.name == "new_name"
        assert result.format_type == "json"
        assert result.schema_def == '{"type":"array"}'
        assert result.example == "[]"
        _patch_factory.commit.assert_awaited_once()
        _patch_factory.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_partial_update(self, _patch_factory):
        schema = _make_schema(id="s1", name="original", format_type="markdown")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = schema
        from virtual_team.repository.schemas import update_output_schema
        result = await update_output_schema("s1", name="renamed")
        assert result.name == "renamed"
        assert result.format_type == "markdown"

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        from virtual_team.repository.schemas import update_output_schema
        result = await update_output_schema("nonexistent", name="X")
        assert result is None
        _patch_factory.commit.assert_not_called()


class TestDeleteOutputSchema:
    @pytest.mark.asyncio
    async def test_deletes(self, _patch_factory):
        schema = _make_schema(id="s1")
        _patch_factory.execute.return_value.scalar_one_or_none.return_value = schema
        from virtual_team.repository.schemas import delete_output_schema
        result = await delete_output_schema("s1")
        assert result is True
        _patch_factory.delete.assert_called_once_with(schema)
        _patch_factory.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_not_found(self, _patch_factory):
        from virtual_team.repository.schemas import delete_output_schema
        result = await delete_output_schema("nonexistent")
        assert result is False
        _patch_factory.delete.assert_not_called()
        _patch_factory.commit.assert_not_called()
