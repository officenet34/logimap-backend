import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let districtDistancesTable = false;
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM district_distances LIMIT 1`;
      districtDistancesTable = true;
    } catch {
      districtDistancesTable = false;
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
        routingProvider: 'district_distances',
        geocodingProvider: null,
        districtDistancesTable,
      };
    } catch {
      return {
        ok: true,
        service: 'logimap-api',
        version: '1.0.0',
        database: 'unreachable',
        dbConnected: false,
        routingProvider: 'district_distances',
        geocodingProvider: null,
        districtDistancesTable,
        hint: 'Coolify Postgres internal URL ve aynı Docker ağı kontrol edin',
      };
    }
  }
}
