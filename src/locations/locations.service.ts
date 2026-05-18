import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestLocationDto } from './dto/ingest-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(userId: string, dto: IngestLocationDto) {
    let organizationId = dto.organizationId ?? null;

    if (!organizationId) {
      const active = await this.prisma.userActiveOrganization.findUnique({
        where: { userId },
      });
      organizationId = active?.organizationId ?? null;
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

  async getMyLatest(userId: string) {
    const latest = await this.prisma.driverLocationLatest.findUnique({
      where: { userId },
    });
    if (!latest) {
      return { location: null };
    }
    return {
      location: {
        latitude: latest.latitude,
        longitude: latest.longitude,
        accuracyM: latest.accuracyM,
        speedMps: latest.speedMps,
        headingDeg: latest.headingDeg,
        batteryPercent: latest.batteryPercent,
        recordedAt: latest.recordedAt,
        organizationId: latest.organizationId,
      },
    };
  }
}
