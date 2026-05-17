import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
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
      };
    } catch {
      return {
        ok: true,
        service: 'logimap-api',
        version: '1.0.0',
        database: 'unreachable',
        dbConnected: false,
        hint: 'Coolify Postgres internal URL ve aynı Docker ağı kontrol edin',
      };
    }
  }
}
