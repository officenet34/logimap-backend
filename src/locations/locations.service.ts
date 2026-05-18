import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestLocationDto } from './dto/ingest-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(userId: string, dto: IngestLocationDto) {
    const minGapMs = 55_000;
    const recent = await this.prisma.driverLocation.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      select: { id: true, recordedAt: true },
    });
    if (
      recent?.recordedAt &&
      Date.now() - recent.recordedAt.getTime() < minGapMs
    ) {
      return {
        success: true,
        id: recent.id,
        recordedAt: recent.recordedAt,
        deduplicated: true,
      };
    }

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

    // driver_location_latest — trigger yoksa bile okuma çalışsın
    await this.prisma.driverLocationLatest.upsert({
      where: { userId },
      create: {
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
      update: {
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
    if (latest) {
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

    // Fallback: latest tablosu boşsa son history kaydı
    const last = await this.prisma.driverLocation.findFirst({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!last) {
      return { location: null };
    }
    return {
      location: {
        latitude: last.latitude,
        longitude: last.longitude,
        accuracyM: last.accuracyM,
        speedMps: last.speedMps,
        headingDeg: last.headingDeg,
        batteryPercent: last.batteryPercent,
        recordedAt: last.recordedAt,
        organizationId: last.organizationId,
      },
    };
  }
}
