#!/bin/sh
# 按 Prisma 的迁移记录表顺序执行未应用的 migration.sql。
# 这样生产镜像里不需要 Node 与 prisma CLI，只要 psql。
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
# Prisma 的 ?schema=public 等参数 psql 不认，去掉查询串
PG_URL=$(printf '%s' "$DATABASE_URL" | sed 's/?.*$//')
PSQL="psql --no-psqlrc --quiet --set ON_ERROR_STOP=1 $PG_URL"

echo "▶ 准备迁移记录表"
$PSQL -c '
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id                      varchar(36) PRIMARY KEY,
  checksum                varchar(64) NOT NULL,
  finished_at             timestamptz,
  migration_name          varchar(255) NOT NULL,
  logs                    text,
  rolled_back_at          timestamptz,
  started_at              timestamptz NOT NULL DEFAULT now(),
  applied_steps_count     integer NOT NULL DEFAULT 0
);' >/dev/null

applied=0
for dir in $(ls -d ./migrations/*/ 2>/dev/null | sort); do
  name=$(basename "$dir")
  [ -f "$dir/migration.sql" ] || continue

  exists=$($PSQL -tAc "SELECT 1 FROM \"_prisma_migrations\" WHERE migration_name = '$name' AND finished_at IS NOT NULL LIMIT 1")
  if [ "$exists" = "1" ]; then
    continue
  fi

  echo "▶ 应用迁移 $name"
  checksum=$(sha256sum "$dir/migration.sql" | cut -d' ' -f1)
  # 迁移与记录写入放在同一个事务里，失败则整体回滚
  {
    echo "BEGIN;"
    cat "$dir/migration.sql"
    echo ""
    echo "INSERT INTO \"_prisma_migrations\" (id, checksum, migration_name, finished_at, applied_steps_count)
          VALUES (gen_random_uuid()::text, '$checksum', '$name', now(), 1);"
    echo "COMMIT;"
  } | $PSQL >/dev/null
  applied=$((applied + 1))
done

echo "✅ 迁移完成，本次应用 $applied 个"
