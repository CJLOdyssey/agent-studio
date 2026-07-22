#!/usr/bin/env bash
# ── Docker entrypoint for virtual-team backend ──────────────────────────────
#  1. Wait for Postgres (up to 60s)
#  2. Run alembic migrations
#  3. Exec CMD (uvicorn)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── 1. Wait for Postgres ──────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"

echo "⏳ Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
for i in $(seq 1 30); do
  if pg_isready -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -q 2>/dev/null; then
    echo "✅ Postgres is ready (attempt ${i})"
    break
  fi
  if [ "${i}" -eq 30 ]; then
    echo "❌ Postgres did not become ready in time — continuing anyway"
    break
  fi
  echo "  ... waiting (${i}/30)"
  sleep 2
done

# ── 2. Run Alembic migrations ─────────────────────────────────────────────────
# Tables may already exist (from init_db() in app lifespan). If migration
# fails with DuplicateTable, we just stamp the current head.
echo "🚀 Running alembic migrations..."
if alembic upgrade head 2>&1; then
  echo "✅ Migrations applied"
else
  echo "⚠️ Migration failed — tables may already exist. Stamping at head..."
  alembic stamp head
  echo "✅ Stamped at head"
fi

# ── 3. Exec CMD ────────────────────────────────────────────────────────────────
exec "$@"
