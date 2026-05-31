#!/usr/bin/env bash
# ECS 自建 GitHub Actions Runner 一键安装脚本
# 用法: bash setup-runner.sh
# 前提: 先到 GitHub Repo → Settings → Actions → Runners → "New self-hosted runner"
#       复制页面上显示的 TOKEN，粘贴到下面的 RUNNER_TOKEN 变量

set -euo pipefail

RUNNER_VERSION="2.322.0"
RUNNER_TOKEN="${1:-}"
REPO="CJLOdyssey/virtual-software-team"

if [ -z "$RUNNER_TOKEN" ]; then
  echo "❌ 请提供 Runner Token: bash setup-runner.sh <TOKEN>"
  echo "   Token 获取: GitHub Repo → Settings → Actions → Runners → New self-hosted runner"
  exit 1
fi

echo "=== 1. 安装 system 依赖 ==="
apt-get update -qq
apt-get install -y -qq curl git docker.io docker-compose-v2 nodejs npm

echo "=== 2. 确保 /opt/virtual-team 存在 ==="
if [ ! -d /opt/virtual-team ]; then
  git clone https://github.com/$REPO.git /opt/virtual-team
  echo "⚠️  已克隆项目到 /opt/virtual-team"
  echo "   请手动创建 /opt/virtual-team/.env 并写入配置"
else
  echo "✅ /opt/virtual-team 已存在"
fi

echo "=== 3. 创建 Runner 目录 ==="
mkdir -p /opt/actions-runner
cd /opt/actions-runner

echo "=== 4. 下载 GitHub Actions Runner ==="
# 国内使用 ghproxy 加速下载
curl -sL "https://ghproxy.net/https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o runner.tar.gz
tar xzf runner.tar.gz
rm runner.tar.gz

echo "=== 5. 配置 Runner ==="
export RUNNER_ALLOW_RUNASROOT=1
./config.sh \
  --url "https://github.com/$REPO" \
  --token "$RUNNER_TOKEN" \
  --name "ecs-prod" \
  --labels "self-hosted" \
  --work "/opt/actions-runner/_work" \
  --unattended \
  --replace

echo "=== 6. 注册为系统服务（开机自启）==="
export RUNNER_ALLOW_RUNASROOT=1
./svc.sh install
./svc.sh start

echo ""
echo "✅ 安装完成！Runner 已启动并注册到 GitHub"
echo "   监听目录: /opt/actions-runner"
echo "   工作目录: /opt/actions-runner/_work"
echo "   生产目录: /opt/virtual-team"
echo ""
echo "   部署流程: 下次 push master 后，CI → Deploy 将直接在 ECS 本地执行"
