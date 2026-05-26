#!/bin/sh
# Coolify: mevcut (dolu) DB'de "prisma migrate deploy" P3005 verir.
# Üye/işletme kodu kolonları idempotent SQL ile uygulanır; API her durumda başlar.

set -e

for MIGRATION_FILE in \
  prisma/migrations/20260522140000_user_member_org_codes/migration.sql \
  prisma/migrations/20260522150000_org_invite_notifications/migration.sql \
  prisma/migrations/20260522160000_vehicle_assigned_driver/migration.sql
do
  if [ -f "$MIGRATION_FILE" ] && [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] SQL uygulanıyor: $MIGRATION_FILE"
    if npx prisma db execute --file "$MIGRATION_FILE" --schema prisma/schema.prisma; then
      echo "[entrypoint] Tamam: $MIGRATION_FILE"
    else
      echo "[entrypoint] UYARI: $MIGRATION_FILE uygulanamadı (API yine başlatılıyor)."
    fi
  fi
done

exec node dist/main.js
