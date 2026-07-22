"""Verify Alembic migration configuration."""
from pathlib import Path


def test_alembic_ini_exists():
    assert Path("alembic.ini").exists(), "alembic.ini not found"


def test_alembic_env_exists():
    assert Path("alembic/env.py").exists(), "alembic/env.py not found"


def test_migrations_dir_exists():
    assert Path("alembic/versions").is_dir(), "alembic/versions/ not found"


def test_alembic_ini_has_sqlalchemy_url():
    content = Path("alembic.ini").read_text()
    assert "sqlalchemy.url" in content, "Missing sqlalchemy.url in alembic.ini"
