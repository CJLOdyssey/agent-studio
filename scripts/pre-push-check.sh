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

# ── Secret leak check ─────────────────────────────────────────────────────────
echo ""
echo "▶ Security: .env leak check"
if [ -f ".env" ]; then
    if [ "$(stat -c '%a' .env)" != "600" ]; then
        echo "⚠️  WARNING: .env permissions are $(stat -c '%a' .env), should be 600"
        echo "   Fix: chmod 600 .env"
    fi
    # Check if .env is staged or tracked by git
    if git ls-files --error-unmatch .env 2>/dev/null; then
        echo "❌ CRITICAL: .env is tracked by git! Remove it immediately."
        echo "   Fix: git rm --cached .env && echo '.env' >> .gitignore"
        exit 1
    fi
    echo "   ✅ .env is properly gitignored"
else
    echo "   ⚠️  .env not found — copy from config/.env.template"
fi

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
