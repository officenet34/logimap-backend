import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connected = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('PostgreSQL bağlantısı başarılı');
      await this.applyIdempotentSchemaPatches();
    } catch (error) {
      this.connected = false;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `PostgreSQL bağlantısı kurulamadı (uygulama yine de açılır). DATABASE_URL host doğru mu? ${msg}`,
      );
    }
  }

  /** Coolify: prisma migrate deploy kullanılmıyor; eksik kolonlar idempotent SQL ile tamamlanır. */
  private async applyIdempotentSchemaPatches() {
    const patches: { name: string; sql: string }[] = [
      {
        name: 'driver_vehicles.assigned_driver_user_id',
        sql: `ALTER TABLE driver_vehicles
          ADD COLUMN IF NOT EXISTS assigned_driver_user_id UUID
          REFERENCES users(id) ON DELETE SET NULL`,
      },
      {
        name: 'idx_driver_vehicles_assigned_driver',
        sql: `CREATE INDEX IF NOT EXISTS idx_driver_vehicles_assigned_driver
          ON driver_vehicles (assigned_driver_user_id)`,
      },
    ];

    for (const patch of patches) {
      try {
        await this.$executeRawUnsafe(patch.sql);
        this.logger.log(`Schema patch: ${patch.name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Schema patch atlanamadı (${patch.name}): ${msg}`);
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
