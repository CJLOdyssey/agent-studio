#!/bin/bash
# ── Pre-push quality gate ─────────────────────────────────────────────────────
# Runs before every `git push`. Fails fast if any check fails.
#
# Install:  ln -s ../../scripts/pre-push-check.sh .git/hooks/pre-push
# Skip:     git push --no-verify
# ────────────────────────────────────────────────────────────────────────────────
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pre-push Quality Gates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Backend ────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Backend: Ruff lint"
python3 -m ruff check virtual_team/ tests/ alembic/

echo ""
echo "▶ Backend: pytest"
python3 -m pytest tests/ -q --tb=short

# ── Frontend ───────────────────────────────────────────────────────────────────
cd frontend

echo ""
echo "▶ Frontend: ESLint + TypeScript"
npm run lint -- --quiet
npm run typecheck

echo ""
echo "▶ Frontend: vitest"
npx vitest run --reporter=dot

cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ All checks passed — pushing..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
