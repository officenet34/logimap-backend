import { Injectable } from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
  RegistrationAccountType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string) {
    return this.prisma.driverVehicle.findUnique({
      where: { userId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async upsertMine(userId: string, dto: UpsertVehicleDto) {
    const images = dto.images ?? [];
    const {
      images: _omit,
      plateTrailer,
      makeModel: _legacyMakeModel,
      ...scalar
    } = dto;

    const makeModel = `${dto.vehicleBrand} ${dto.vehicleModel}`.trim();

    const vehicle = await this.prisma.driverVehicle.upsert({
      where: { userId },
      create: {
        userId,
        ...scalar,
        makeModel,
        plateTrailer: plateTrailer ?? null,
      },
      update: {
        ...scalar,
        makeModel,
        plateTrailer: plateTrailer ?? null,
      },
    });

    await this.prisma.driverVehicleImage.deleteMany({
      where: { vehicleId: vehicle.id },
    });

    if (images.length > 0) {
      await this.prisma.driverVehicleImage.createMany({
        data: images.map((img, i) => ({
          vehicleId: vehicle.id,
          imageUrl: img.imageUrl,
          thumbnailUrl: img.thumbnailUrl,
          sortOrder: img.sortOrder ?? i,
        })),
      });
    }

    return this.getMine(userId);
  }

  /** İşletmedeki kayıtlı araçlar (şoför + araç + son konum). */
  async listFleet(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        registrationType: true,
        activeOrganization: { select: { organizationId: true } },
        organizationMembers: {
          where: { status: InvitationStatus.accepted },
          orderBy: { joinedAt: 'desc' },
          take: 1,
          select: { organizationId: true, memberRole: true },
        },
      },
    });
    if (!user) return [];

    const orgId =
      user.activeOrganization?.organizationId ??
      user.organizationMembers[0]?.organizationId;

    const isOrgManager =
      user.registrationType === RegistrationAccountType.sole_proprietor ||
      user.registrationType === RegistrationAccountType.company;

    if (orgId && isOrgManager) {
      const drivers = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: orgId,
          status: InvitationStatus.accepted,
          memberRole: OrganizationMemberRole.driver,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              profileImageThumbnailUrl: true,
              driverVehicle: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' } },
                },
              },
              driverLocationLatest: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });

      return drivers
        .filter((m) => m.user.driverVehicle != null)
        .map((m) => this.mapFleetRow(m.user));
    }

    const self = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        profileImageThumbnailUrl: true,
        driverVehicle: {
          include: { images: { orderBy: { sortOrder: 'asc' } } },
        },
        driverLocationLatest: true,
      },
    });

    if (!self?.driverVehicle) return [];
    return [this.mapFleetRow(self)];
  }

  private mapFleetRow(user: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    profileImageThumbnailUrl: string | null;
    driverVehicle: {
      vehicleBrand: string;
      vehicleModel: string;
      plateVehicle: string;
      plateTrailer: string | null;
      vehicleType: string;
      bodyType: string;
      images: { imageUrl: string; thumbnailUrl: string; sortOrder: number }[];
    } | null;
    driverLocationLatest: {
      latitude: number;
      longitude: number;
      recordedAt: Date;
    } | null;
  }) {
    const v = user.driverVehicle!;
    const thumb = user.profileImageThumbnailUrl ?? user.profileImageUrl;
    const firstImg = v.images[0];
    const loc = user.driverLocationLatest;
    return {
      driver: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: thumb,
      },
      vehicle: {
        vehicleBrand: v.vehicleBrand,
        vehicleModel: v.vehicleModel,
        plateVehicle: v.plateVehicle,
        plateTrailer: v.plateTrailer,
        vehicleType: v.vehicleType,
        bodyType: v.bodyType,
        thumbnailUrl: firstImg?.thumbnailUrl ?? firstImg?.imageUrl ?? null,
        imageUrl: firstImg?.imageUrl ?? null,
      },
      lastLocation: loc
        ? {
            latitude: loc.latitude,
            longitude: loc.longitude,
            recordedAt: loc.recordedAt.toISOString(),
          }
        : null,
    };
  }
}
