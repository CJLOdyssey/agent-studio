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
git pull origin main

echo "[deploy] Pulling latest Docker images..."
docker compose -f "$COMPOSE_FILE" pull

echo "[deploy] Extracting frontend dist from image..."
ACR_REG="${ACR_REGISTRY:-crpi-j0fhvkobexa3ilkn.cn-shenzhen.personal.cr.aliyuncs.com}"
ACR_NS="${ACR_NAMESPACE:-virtual-team}"
IMAGE_TAG=$(grep IMAGE_TAG .env | cut -d= -f2)
FULL_IMAGE="${ACR_REG}/${ACR_NS}/virtual-team:${IMAGE_TAG:-latest}"
CONTAINER=$(docker create "$FULL_IMAGE")
mkdir -p frontend/dist
docker cp "$CONTAINER":/app/frontend/dist frontend/ || true
docker rm "$CONTAINER" > /dev/null

echo "[deploy] Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm api alembic upgrade head

echo "[deploy] Restarting all containers..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "[deploy] Cleaning old images..."
docker image prune -f --filter "until=24h"

echo "[deploy] Done. Status:"
docker compose -f "$COMPOSE_FILE" ps
