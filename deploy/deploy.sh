#!/usr/bin/env bash
# 一键部署：本机构建 linux/amd64 镜像 → 传到服务器 → docker compose up
# 用法：deploy/deploy.sh [--with-migrate]   （首次或升级 prisma 版本时加 --with-migrate）
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=${DEPLOY_HOST:-root@101.37.37.200}
KEY=${DEPLOY_KEY:-$HOME/Downloads/ipad.pem}
DIR=${DEPLOY_DIR:-/root/docker-compose/yukiTrace}
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $HOST"
WITH_MIGRATE=${1:-}

echo "▶ 构建 runner (linux/amd64)"
docker buildx build --platform linux/amd64 --target runner -t yukitrace:latest --load . >/dev/null
if [[ "$WITH_MIGRATE" == "--with-migrate" ]]; then
  echo "▶ 构建 migrate (linux/amd64)"
  docker buildx build --platform linux/amd64 --target migrate -t yukitrace-migrate:latest --load . >/dev/null
fi

echo "▶ 同步 compose / prisma"
$SSH "mkdir -p $DIR/prisma"
scp -i "$KEY" -o StrictHostKeyChecking=no -q docker-compose.yml prisma.config.ts "$HOST:$DIR/"
COPYFILE_DISABLE=1 tar czf - prisma/schema.prisma prisma/migrations | $SSH "cd $DIR && tar xzf - && find . -name '._*' -delete"

echo "▶ 传输镜像（gzip 流式）"
IMAGES="yukitrace:latest"
[[ "$WITH_MIGRATE" == "--with-migrate" ]] && IMAGES="$IMAGES yukitrace-migrate:latest"
docker save $IMAGES | gzip -1 | $SSH "gunzip | docker load"

echo "▶ 启动"
$SSH "cd $DIR && docker compose up -d --remove-orphans && docker compose ps"
echo "✅ 完成：$($SSH "grep -E '^APP_URL' $DIR/.env | cut -d= -f2")"
