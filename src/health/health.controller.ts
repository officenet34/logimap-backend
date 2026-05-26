import { Controller, Get } from '@nestjs/common';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getUploadsRoot } from '../config/uploads.config';
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

  /** Resim 404 teşhisi: volume bağlı mı, klasörde dosya var mı? */
  @Get('uploads')
  uploads() {
    const root = getUploadsRoot();
    const categories = ['avatars', 'vehicles', 'org-logos'] as const;
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      const dir = join(root, cat);
      counts[cat] = existsSync(dir) ? readdirSync(dir).length : -1;
    }
    const total = Object.values(counts).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    return {
      ok: total > 0,
      uploadRoot: root,
      fileCounts: counts,
      hint:
        total === 0
          ? 'UPLOAD_ROOT volume bağlayın (/app/uploads) veya resimleri yeniden yükleyin'
          : undefined,
      mediaUrlPattern: '/v1/media/asset/{avatars|vehicles|org-logos}/{filename}',
    };
  }
}
