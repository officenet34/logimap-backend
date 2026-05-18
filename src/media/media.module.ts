import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MediaController],
})
export class MediaModule {}
