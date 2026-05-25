#!/bin/sh
# Coolify: mevcut (dolu) DB'de "prisma migrate deploy" P3005 verir.
# Üye/işletme kodu kolonları idempotent SQL ile uygulanır; API her durumda başlar.

set -e

MIGRATION_FILE="prisma/migrations/20260522140000_user_member_org_codes/migration.sql"

if [ -f "$MIGRATION_FILE" ] && [ -n "$DATABASE_URL" ]; then
  echo "[entrypoint] member_code / org_code SQL uygulanıyor (idempotent)..."
  if npx prisma db execute --file "$MIGRATION_FILE" --schema prisma/schema.prisma; then
    echo "[entrypoint] SQL tamamlandı."
  else
    echo "[entrypoint] UYARI: SQL uygulanamadı (API yine de başlatılıyor). Coolify Postgres'te 002_user_member_code.sql çalıştırın."
  fi
else
  echo "[entrypoint] SQL atlandı (dosya veya DATABASE_URL yok)."
fi

exec node dist/main.js
