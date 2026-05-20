import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const routesKey = this.config.get<string>('GOOGLE_ROUTES_API_KEY')?.trim() ?? '';
    const routesConfigured =
      routesKey.length > 0 && !routesKey.includes('BURAYA_ROUTES');

    let routeCacheTable = false;
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM route_distance_cache LIMIT 1`;
      routeCacheTable = true;
    } catch {
      routeCacheTable = false;
    }

    try {
      const rows = await this.prisma.$queryRaw<Array<{ db: string }>>`
        SELECT current_database() AS db
      `;
      return {
        ok: true,
        service: 'logimap-api',
        version: '1.0.0',
        database: rows[0]?.db ?? 'unknown',
        dbConnected: true,
        routesConfigured,
        routeCacheTable,
      };
    } catch {
      return {
        ok: true,
        service: 'logimap-api',
        version: '1.0.0',
        database: 'unreachable',
        dbConnected: false,
        routesConfigured,
        routeCacheTable,
        hint: 'Coolify Postgres internal URL ve aynı Docker ağı kontrol edin',
      };
    }
  }
}
