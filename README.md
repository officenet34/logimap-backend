# LogiMap API

NestJS + Prisma + PostgreSQL (`logimap_db`)

## Coolify deploy

1. Repo: `logimap-backend`
2. **Root Directory**: `/` (repo kökü bu klasörse)
3. **Build Pack**: Dockerfile
4. **Port**: `3000`
5. **Health Check**: `GET /v1/health`

### Veritabanı (üye kodu / org kodu)

Production DB zaten dolu olduğu için **`prisma migrate deploy` kullanılmaz** (P3005: schema not empty).

Container açılışında `scripts/docker-entrypoint.sh` şunu çalıştırır:

Entrypoint sırayla çalıştırır:

- `prisma/migrations/20260522140000_user_member_org_codes/migration.sql` (`002_user_member_code.sql`)
- `prisma/migrations/20260522150000_org_invite_notifications/migration.sql` (`003_org_invite_notifications.sql` — Personel rolü CHECK + `app_notifications`)
- `prisma/migrations/20260522160000_vehicle_assigned_driver/migration.sql` (`004_vehicle_assigned_driver.sql` — araç şoför ataması)

Manuel yedek (Coolify Postgres → Query): `database/logimap/004_vehicle_assigned_driver.sql` — özellikle **Araçlar** sayfasında `assigned_driver_user_id does not exist` hatası görürseniz bir kez çalıştırın.

API açılışında `PrismaService` aynı idempotent SQL’i de dener (entrypoint atlanmışsa).

### Environment

| Key | Açıklama |
|-----|----------|
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/logimap_db` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `30d` |
| `CORS_ORIGINS` | `*` veya domain listesi |
| `PUBLIC_API_URL` | `https://api.logimap.com.tr` (avatar/upload URL’leri) |
| `PORT` | `3000` |

### Coolify domain (Traefik)

| Alt alan | Amaç |
|----------|------|
| `logimap.com.tr` | Web sitesi (ayrı servis / statik) |
| `api.logimap.com.tr` | Bu NestJS backend — health: `GET /v1/health` |

## API özeti

| Method | Path |
|--------|------|
| GET | `/v1/health` |
| POST | `/v1/auth/register/sole-proprietor` |
| POST | `/v1/auth/register/company` |
| POST | `/v1/auth/register/driver` |
| POST | `/v1/auth/login` |
| POST | `/v1/auth/refresh` |
| POST | `/v1/auth/logout` |
| GET | `/v1/auth/me` |
| GET | `/v1/organizations` |
| GET | `/v1/organizations/:id` |
| PATCH | `/v1/organizations/:id` |
| POST | `/v1/media/me/org-logo` |
| GET | `/v1/organizations/:id/drivers/locations` |
| POST | `/v1/organizations/:id/members/invite` |
| POST | `/v1/organizations/:id/invitations/driver` |
| POST | `/v1/organizations/:id/members/self-driver` |
| GET | `/v1/invitations/pending` |
| POST | `/v1/invitations/:code/accept` |
| POST | `/v1/invitations/:code/reject` |
| GET | `/v1/notifications` |
| PATCH | `/v1/notifications/:id/read` |
| POST | `/v1/locations` |
