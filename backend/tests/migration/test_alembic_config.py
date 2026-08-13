"""Verify Alembic migration configuration."""
from pathlib import Path

# Tests run from backend/ (pytest rootdir is the repo root via pyproject).
# Resolve repo-relative paths from this file's location instead of CWD.
REPO_ROOT = Path(__file__).resolve().parents[3]


def test_alembic_ini_exists():
    assert (REPO_ROOT / "alembic.ini").exists(), "alembic.ini not found"


def test_alembic_env_exists():
    assert (REPO_ROOT / "backend/alembic/env.py").exists(), "backend/alembic/env.py not found"


def test_migrations_dir_exists():
    assert (REPO_ROOT / "backend/alembic/versions").is_dir(), "backend/alembic/versions/ not found"


def test_alembic_ini_has_sqlalchemy_url():
    content = (REPO_ROOT / "alembic.ini").read_text()
    assert "sqlalchemy.url" in content, "Missing sqlalchemy.url in alembic.ini"
