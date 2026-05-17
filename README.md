# LogiMap API

NestJS + Prisma + PostgreSQL (`logimap_db`)

## Coolify deploy

1. Repo: `logimap-backend`
2. **Root Directory**: `/` (repo kökü bu klasörse)
3. **Build Pack**: Dockerfile
4. **Port**: `3000`
5. **Health Check**: `GET /v1/health`

### Environment

| Key | Açıklama |
|-----|----------|
| `DATABASE_URL` | `postgresql://USER:PASS@HOST:5432/logimap_db` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `30d` |
| `CORS_ORIGINS` | `*` veya domain listesi |
| `PORT` | `3000` |

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
| GET | `/v1/organizations/:id/drivers/locations` |
| POST | `/v1/organizations/:id/invitations/driver` |
| POST | `/v1/organizations/:id/members/self-driver` |
| GET | `/v1/invitations/pending` |
| POST | `/v1/invitations/:code/accept` |
| POST | `/v1/locations` |
