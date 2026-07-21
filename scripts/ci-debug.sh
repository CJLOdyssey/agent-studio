#!/bin/bash
# ci-debug — gh-fix-ci skill 便捷封装
# 用法: bash scripts/ci-debug.sh [PR编号]
# 默认检查当前分支 PR

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_SCRIPT="$HOME/.codex/skills/gh-fix-ci/scripts/inspect_pr_checks.py"

if [ ! -f "$SKILL_SCRIPT" ]; then
  echo "gh-fix-ci skill 未安装，请运行:"
  echo "  python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py --repo openai/skills --path skills/.curated/gh-fix-ci"
  exit 1
fi

REPO="."
PR_ARG=""

if [ $# -gt 0 ]; then
  PR_ARG="--pr $1"
fi

python3 "$SKILL_SCRIPT" --repo "$REPO" $PR_ARG "$@"
