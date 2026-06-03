#!/usr/bin/env bash
set -a
source <(grep -v '^\s*#' .env | grep -v '^\s*$')
set +a
exec uvicorn virtual_team.app:app --reload --port 8080 --host 0.0.0.0
