import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IngestLocationDto } from './dto/ingest-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(userId: string, dto: IngestLocationDto) {
    let organizationId = dto.organizationId;

    if (organizationId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          memberRole: OrganizationMemberRole.driver,
          status: InvitationStatus.accepted,
          shareLocation: true,
        },
      });
      if (!member) {
        throw new ForbiddenException('Bu işletme için konum gönderemezsiniz');
      }
    } else {
      const active = await this.prisma.userActiveOrganization.findUnique({
        where: { userId },
      });
      organizationId = active?.organizationId;
    }

    const recordedAt = new Date();

    const location = await this.prisma.driverLocation.create({
      data: {
        userId,
        organizationId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyM: dto.accuracyM,
        speedMps: dto.speedMps,
        headingDeg: dto.headingDeg,
        batteryPercent: dto.batteryPercent,
        recordedAt,
      },
    });

    return {
      success: true,
      id: location.id,
      recordedAt: location.recordedAt,
    };
  }
}
