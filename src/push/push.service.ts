import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@Injectable()
export class PushService {
  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, dto: RegisterPushTokenDto) {
    await this.prisma.userPushToken.updateMany({
      where: { userId, fcmToken: { not: dto.fcmToken } },
      data: { isActive: false },
    });

    const row = await this.prisma.userPushToken.upsert({
      where: {
        userId_fcmToken: { userId, fcmToken: dto.fcmToken },
      },
      create: {
        userId,
        fcmToken: dto.fcmToken,
        platform: dto.platform,
        deviceLabel: dto.deviceLabel,
        isActive: true,
      },
      update: {
        platform: dto.platform,
        deviceLabel: dto.deviceLabel,
        isActive: true,
      },
    });

    return { success: true, id: row.id };
  }
}
