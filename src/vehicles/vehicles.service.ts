import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';

const vehicleInclude = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  assignedDriver: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      phone: true,
    },
  },
} as const;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private mapVehicle(row: {
    id: string;
    userId: string;
    vehicleBrand: string;
    vehicleModel: string;
    makeModel: string | null;
    plateVehicle: string;
    plateTrailer: string | null;
    vehicleType: string;
    modelYear: string;
    color: string;
    bodyType: string;
    widthCm: string;
    lengthCm: string;
    heightCm: string;
    bodyVolumeM3: string;
    tonnageKg: string;
    extraInfo: string;
    createdAt: Date;
    updatedAt: Date;
    images: {
      id: string;
      imageUrl: string;
      thumbnailUrl: string;
      sortOrder: number;
    }[];
    assignedDriverUserId: string | null;
    assignedDriver: {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
      phone: string;
    } | null;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      assignedDriverUserId: row.assignedDriverUserId,
      assignedDriver: row.assignedDriver
        ? {
            id: row.assignedDriver.id,
            firstName: row.assignedDriver.firstName,
            lastName: row.assignedDriver.lastName,
            profileImageUrl: row.assignedDriver.profileImageUrl,
            phone: row.assignedDriver.phone,
          }
        : null,
      vehicleBrand: row.vehicleBrand,
      vehicleModel: row.vehicleModel,
      makeModel: row.makeModel,
      plateVehicle: row.plateVehicle,
      plateTrailer: row.plateTrailer,
      vehicleType: row.vehicleType,
      modelYear: row.modelYear,
      color: row.color,
      bodyType: row.bodyType,
      widthCm: row.widthCm,
      lengthCm: row.lengthCm,
      heightCm: row.heightCm,
      bodyVolumeM3: row.bodyVolumeM3,
      tonnageKg: row.tonnageKg,
      extraInfo: row.extraInfo,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      images: row.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        thumbnailUrl: img.thumbnailUrl,
        sortOrder: img.sortOrder,
      })),
    };
  }

  private async persistImages(
    vehicleId: string,
    images: UpsertVehicleDto['images'],
  ) {
    await this.prisma.driverVehicleImage.deleteMany({ where: { vehicleId } });
    if (images && images.length > 0) {
      await this.prisma.driverVehicleImage.createMany({
        data: images.map((img, i) => ({
          vehicleId,
          imageUrl: img.imageUrl,
          thumbnailUrl: img.thumbnailUrl,
          sortOrder: img.sortOrder ?? i,
        })),
      });
    }
  }

  private scalarFromDto(dto: UpsertVehicleDto) {
    const {
      images: _omit,
      plateTrailer,
      makeModel: _legacyMakeModel,
      ...scalar
    } = dto;
    const makeModel = `${dto.vehicleBrand} ${dto.vehicleModel}`.trim();
    return {
      ...scalar,
      makeModel,
      plateTrailer: plateTrailer ?? null,
    };
  }

  async listMine(userId: string) {
    const rows = await this.prisma.driverVehicle.findMany({
      where: { userId },
      include: vehicleInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapVehicle(r));
  }

  async getMine(userId: string) {
    const row = await this.prisma.driverVehicle.findFirst({
      where: { userId },
      include: vehicleInclude,
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.mapVehicle(row) : null;
  }

  async getMineById(userId: string, id: string) {
    const row = await this.prisma.driverVehicle.findUnique({
      where: { id },
      include: vehicleInclude,
    });
    if (!row) throw new NotFoundException('Araç bulunamadı');
    if (row.userId !== userId) throw new ForbiddenException();
    return this.mapVehicle(row);
  }

  async createMine(userId: string, dto: UpsertVehicleDto) {
    const images = dto.images ?? [];
    const vehicle = await this.prisma.driverVehicle.create({
      data: {
        userId,
        ...this.scalarFromDto(dto),
      },
    });
    await this.persistImages(vehicle.id, images);
    return this.getMineById(userId, vehicle.id);
  }

  async updateMine(userId: string, id: string, dto: UpsertVehicleDto) {
    const existing = await this.prisma.driverVehicle.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Araç bulunamadı');
    if (existing.userId !== userId) throw new ForbiddenException();

    await this.prisma.driverVehicle.update({
      where: { id },
      data: this.scalarFromDto(dto),
    });
    await this.persistImages(id, dto.images ?? []);
    return this.getMineById(userId, id);
  }

  async assignDriver(
    ownerUserId: string,
    vehicleId: string,
    driverUserId: string | null,
  ) {
    const vehicle = await this.prisma.driverVehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Araç bulunamadı');
    if (vehicle.userId !== ownerUserId) throw new ForbiddenException();

    if (driverUserId) {
      const ownerOrg = await this.prisma.organizationMember.findFirst({
        where: {
          userId: ownerUserId,
          memberRole: OrganizationMemberRole.owner,
          status: InvitationStatus.accepted,
        },
        select: { organizationId: true },
      });
      if (!ownerOrg) {
        throw new ForbiddenException('İşletme yöneticisi değilsiniz');
      }
      const driverMember = await this.prisma.organizationMember.findFirst({
        where: {
          organizationId: ownerOrg.organizationId,
          userId: driverUserId,
          memberRole: OrganizationMemberRole.driver,
          status: InvitationStatus.accepted,
        },
      });
      if (!driverMember) {
        throw new BadRequestException(
          'Seçilen kullanıcı işletmenizde kayıtlı şoför değil',
        );
      }
    }

    await this.prisma.driverVehicle.update({
      where: { id: vehicleId },
      data: { assignedDriverUserId: driverUserId },
    });
    return this.getMineById(ownerUserId, vehicleId);
  }

  async deleteMine(userId: string, id: string) {
    const existing = await this.prisma.driverVehicle.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Araç bulunamadı');
    if (existing.userId !== userId) throw new ForbiddenException();
    await this.prisma.driverVehicle.delete({ where: { id } });
    return { success: true };
  }

  /** Geriye dönük: ilk aracı günceller veya yeni oluşturur. */
  async upsertMine(userId: string, dto: UpsertVehicleDto) {
    const existing = await this.prisma.driverVehicle.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      return this.updateMine(userId, existing.id, dto);
    }
    return this.createMine(userId, dto);
  }

  /** İşletmedeki kayıtlı araçlar (üye başına en güncel araç). */
  async listFleet(userId: string) {
    type FleetVehicle = {
      vehicleBrand: string;
      vehicleModel: string;
      plateVehicle: string;
      plateTrailer: string | null;
      vehicleType: string;
      bodyType: string;
      images: { imageUrl: string; thumbnailUrl: string; sortOrder: number }[];
    };

    type FleetUserRow = {
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
      profileImageThumbnailUrl: string | null;
      driverVehicles: FleetVehicle[];
      driverLocationLatest: {
        latitude: number;
        longitude: number;
        recordedAt: Date;
      } | null;
    };

    const seen = new Set<string>();
    const rows: ReturnType<VehiclesService['mapFleetRow']>[] = [];

    const pushUser = (u: FleetUserRow | null | undefined) => {
      const v = u?.driverVehicles[0];
      if (!v || !u || seen.has(u.id)) return;
      seen.add(u.id);
      rows.push(
        this.mapFleetRow({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          profileImageUrl: u.profileImageUrl,
          profileImageThumbnailUrl: u.profileImageThumbnailUrl,
          driverVehicle: v,
          driverLocationLatest: u.driverLocationLatest,
        }),
      );
    };

    const userSelect = {
      id: true,
      firstName: true,
      lastName: true,
      profileImageUrl: true,
      profileImageThumbnailUrl: true,
      driverVehicles: {
        include: vehicleInclude,
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
      driverLocationLatest: true,
    } as const;

    const self = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    pushUser(self);

    const ctx = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        activeOrganization: { select: { organizationId: true } },
        organizationMembers: {
          where: { status: InvitationStatus.accepted },
          orderBy: { joinedAt: 'desc' },
          take: 1,
          select: { organizationId: true },
        },
      },
    });

    const orgId =
      ctx?.activeOrganization?.organizationId ??
      ctx?.organizationMembers[0]?.organizationId;

    if (orgId) {
      const members = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: orgId,
          status: InvitationStatus.accepted,
        },
        include: {
          user: { select: userSelect },
        },
        orderBy: { joinedAt: 'asc' },
      });
      for (const m of members) {
        pushUser(m.user);
      }

      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { createdByUserId: true },
      });
      if (org?.createdByUserId) {
        const creator = await this.prisma.user.findUnique({
          where: { id: org.createdByUserId },
          select: userSelect,
        });
        pushUser(creator);
      }
    }

    return rows;
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
    };
    driverLocationLatest: {
      latitude: number;
      longitude: number;
      recordedAt: Date;
    } | null;
  }) {
    const v = user.driverVehicle;
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
