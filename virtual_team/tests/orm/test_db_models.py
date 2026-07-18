"""Tests for virtual_team/orm/ — ORM table definitions."""
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

def test_tables_registered():
    from virtual_team.core.base import Base
    tables = {t.name for t in Base.metadata.sorted_tables}
    assert "agent_configs" in tables
    assert "sessions" in tables

def test_agent_columns():
    from sqlalchemy import inspect
    from virtual_team.orm.agent import AgentConfigDB
    cols = {c.name for c in inspect(AgentConfigDB).columns}
    assert "name" in cols
    assert "role_identifier" in cols
