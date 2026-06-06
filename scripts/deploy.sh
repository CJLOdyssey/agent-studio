#!/usr/bin/env bash
# ECS 部署脚本 — 手动部署时使用（CI 部署走 GitHub Actions）
# 使用方法: chmod +x && ./deploy.sh
#
# 首次部署:
#   mkdir -p /opt/virtual-team
#   git clone <repo-url> /opt/virtual-team
#   cp this-file /root/deploy.sh && chmod +x /root/deploy.sh
#   nano /opt/virtual-team/.env  # 写入配置
#   /root/deploy.sh

set -euo pipefail

PROJECT_DIR="/opt/virtual-team"
COMPOSE_FILE="config/docker/docker-compose.yml"

cd "$PROJECT_DIR"

echo "[deploy] Pulling latest code..."
git pull origin master

echo "[deploy] Building frontend (via Docker)..."
docker run --rm \
  -v "${PROJECT_DIR}/frontend:/app" \
  -w /app \
  node:20-alpine \
  sh -c "npm ci 2>/dev/null || npm install; npx vite build --logLevel error"

echo "[deploy] Pulling latest Docker images..."
docker compose -f "$COMPOSE_FILE" pull

echo "[deploy] Restarting all containers..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "[deploy] Cleaning old images..."
docker image prune -f

echo "[deploy] Done. Status:"
docker compose -f "$COMPOSE_FILE" ps
