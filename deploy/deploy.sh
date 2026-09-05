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

read_remote_env() {
  local name=$1
  local value
  value=$($SSH "sed -n 's/^${name}=//p' '$DIR/.env' | tail -n 1")
  value=${value%$'\r'}

  if [[ ${#value} -ge 2 ]]; then
    local first=${value:0:1}
    local last=${value: -1}
    if [[ "$first" == "$last" && ( "$first" == '"' || "$first" == "'" ) ]]; then
      value=${value:1:${#value}-2}
    fi
  fi

  printf '%s' "$value"
}

AMAP_BUILD_JS_KEY=${NEXT_PUBLIC_AMAP_JS_KEY:-$(read_remote_env NEXT_PUBLIC_AMAP_JS_KEY)}
AMAP_BUILD_SECURITY_CODE=${NEXT_PUBLIC_AMAP_SECURITY_CODE:-$(read_remote_env NEXT_PUBLIC_AMAP_SECURITY_CODE)}
PUBLIC_BUILD_ARGS=()
[[ -n "$AMAP_BUILD_JS_KEY" ]] && PUBLIC_BUILD_ARGS+=(--build-arg "NEXT_PUBLIC_AMAP_JS_KEY=$AMAP_BUILD_JS_KEY")
[[ -n "$AMAP_BUILD_SECURITY_CODE" ]] && PUBLIC_BUILD_ARGS+=(--build-arg "NEXT_PUBLIC_AMAP_SECURITY_CODE=$AMAP_BUILD_SECURITY_CODE")

echo "▶ 构建 runner (linux/amd64)"
docker buildx build --platform linux/amd64 --target runner -t yukitrace:latest --load "${PUBLIC_BUILD_ARGS[@]}" . >/dev/null
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
