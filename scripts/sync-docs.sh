#!/usr/bin/env bash
set -euo pipefail

# sync-docs.sh — 自动修正 AGENTS.md / CLAUDE.md 中的数字与代码库一致
# 用法: ./scripts/sync-docs.sh
# 无参数，发现不一致直接原地修改文件

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$(dirname "$0")/.." && pwd)")"
cd "$PROJECT_ROOT"

changed=0

# ── 1. Routers ──────────────────────────────────────────────────────────────
actual_routers=$(ls backend/routers/*.py | grep -v __init__ | wc -l)
expected_routers=$(grep -oP 'routers/ \(\K[0-9]+' AGENTS.md || true)
if [ "$actual_routers" != "$expected_routers" ]; then
  echo "  Routers: $expected_routers → $actual_routers"
  sed -i "s/routers/ ($expected_routers modules/routers/ ($actual_routers modules/" AGENTS.md
  changed=1
fi

# ── 2. Repository ───────────────────────────────────────────────────────────
actual_repos=$(ls backend/repository/*.py | grep -v __init__ | wc -l)
expected_repos=$(grep -oP 'repository/ \(\K[0-9]+' AGENTS.md || true)
if [ "$actual_repos" != "$expected_repos" ]; then
  echo "  Repository: $expected_repos → $actual_repos"
  sed -i "s/repository/ ($expected_repos modules/repository/ ($actual_repos modules/" AGENTS.md
  changed=1
fi

# ── 3. DB models ────────────────────────────────────────────────────────────
actual_models=$(python3 -c "
import re
with open('backend/database.py') as f:
    content = f.read()
classes = re.findall(r'class (\w+)\(Base\)', content)
print(len(classes))
")
# Also count checkpoint models
actual_ckpt=$(python3 -c "
import re
try:
    with open('backend/checkpoint.py') as f:
        content = f.read()
    classes = re.findall(r'class (\w+)\(Base\)', content)
    print(len(classes))
except FileNotFoundError:
    print(0)
")
actual_total=$((actual_models + actual_ckpt))
expected_total=$(grep -oP 'database\.py \(\K[0-9]+' AGENTS.md || true)
# Also extract the incl. checkpoint number on same line
expected_tables=$(grep -oP 'database\.py \([0-9]+ ORM models, \K[0-9]+' AGENTS.md || true)
actual_tables=$((actual_models + actual_ckpt))  # same as models for simplicity

if [ "$actual_total" != "$expected_total" ]; then
  echo "  DB models: $expected_total → $actual_total"
  sed -i "s/database.py ($expected_total ORM models/database.py ($actual_total ORM models/" AGENTS.md
  sed -i "s/ORM models, $expected_tables tables/ORM models, $actual_tables tables/" AGENTS.md
  changed=1
fi

# ── 4. Workstation modules (CLAUDE.md) ────────────────────────────────────
actual_modules=$(ls -d frontend/src/components/agentstudio/workstation/*/ 2>/dev/null | grep -v '/shared/' | wc -l)
expected_modules=$(grep -oP '工作台 \K[0-9]+' CLAUDE.md || true)
if [ "$actual_modules" != "$expected_modules" ]; then
  echo "  Workstation: $expected_modules → $actual_modules"
  sed -i "s/工作台 $expected_modules 模块/工作台 $actual_modules 模块/" CLAUDE.md
  sed -i "s/工作台菜单入口（${expected_modules} Tab）/工作台菜单入口（${actual_modules} Tab）/" CLAUDE.md
  changed=1
fi

# ── Report ──────────────────────────────────────────────────────────────────
if [ "$changed" -eq 1 ]; then
  echo "✅ Docs synced — changes applied."
else
  echo "✅ All docs already consistent."
fi
exit 0
