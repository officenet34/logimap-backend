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
    } catch (error) {
      this.connected = false;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `PostgreSQL bağlantısı kurulamadı (uygulama yine de açılır). DATABASE_URL host doğru mu? ${msg}`,
      );
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
