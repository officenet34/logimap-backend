import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FreightShipmentStatus,
  InvitationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFreightShipmentDto } from './dto/create-freight-shipment.dto';

@Injectable()
export class FreightShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveOrganizationId(userId: string): Promise<string | null> {
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
    return (
      ctx?.activeOrganization?.organizationId ??
      ctx?.organizationMembers[0]?.organizationId ??
      null
    );
  }

  private mapShipment(row: Awaited<ReturnType<FreightShipmentsService['findById']>>) {
    if (!row) return null;
    const legs = row.routeLegsJson;
    const returnLegs = row.returnRouteLegsJson;
    return {
      id: row.id,
      userId: row.userId,
      organizationId: row.organizationId,
      status: row.status,
      startProvince: row.startProvince,
      startDistrict: row.startDistrict,
      startAt: row.startAt.toISOString(),
      startBreakMinutes: row.startBreakMinutes,
      endProvince: row.endProvince,
      endDistrict: row.endDistrict,
      vehicleReturnAt: row.vehicleReturnAt.toISOString(),
      endRestMinutes: row.endRestMinutes,
      estimatedDistanceKm: row.estimatedDistanceKm,
      estimatedDurationSeconds: row.estimatedDurationSeconds,
      estimatedRouteFromLabel: row.estimatedRouteFromLabel,
      estimatedRouteToLabel: row.estimatedRouteToLabel,
      routeLegs: Array.isArray(legs) ? legs : [],
      routeStops: row.routeStops.map((s) => ({
        province: s.province,
        district: s.district,
        breakMinutes: s.breakMinutes,
        sortOrder: s.sortOrder,
      })),
      returnStartProvince: row.returnStartProvince,
      returnStartDistrict: row.returnStartDistrict,
      returnEndProvince: row.returnEndProvince,
      returnEndDistrict: row.returnEndDistrict,
      returnStartBreakMinutes: row.returnStartBreakMinutes,
      returnEstimatedDistanceKm: row.returnEstimatedDistanceKm,
      returnEstimatedDurationSeconds: row.returnEstimatedDurationSeconds,
      returnEstimatedRouteFromLabel: row.returnEstimatedRouteFromLabel,
      returnEstimatedRouteToLabel: row.returnEstimatedRouteToLabel,
      returnRouteLegs: Array.isArray(returnLegs) ? returnLegs : [],
      returnRouteStops: row.returnRouteStops.map((s) => ({
        province: s.province,
        district: s.district,
        breakMinutes: s.breakMinutes,
        sortOrder: s.sortOrder,
      })),
      outbound: {
        hasLoad: row.outboundHasLoad,
        loadStatus: row.outboundLoadStatus,
        canTakeExtraLoad: row.outboundCanTakeExtraLoad,
        loadDescription: row.outboundLoadDescription,
        fillPercent: row.outboundFillPercent,
        tonnageFullness: row.outboundTonnageFullness,
        cargoSpaceEmpty: row.outboundCargoSpaceEmpty,
        tonnageEmpty: row.outboundTonnageEmpty,
        loadCriteria: row.outboundLoadCriteria,
        loadAtStops: row.loadAtStops
          .filter((l) => l.direction === 'outbound')
          .map((l) => ({
            routeStopIndex: l.routeStopIndex,
            fillPercent: l.fillPercent,
            tonnageKg: l.tonnageKg,
            cargoM3: l.cargoM3,
            loadCriteria: l.loadCriteria,
          })),
      },
      return: {
        hasLoad: row.returnHasLoad,
        loadStatus: row.returnLoadStatus,
        loadDescription: row.returnLoadDescription,
        canTakeExtraLoad: row.returnCanTakeExtraLoad,
        fillPercent: row.returnFillPercent,
        tonnageFullness: row.returnTonnageFullness,
        cargoSpaceEmpty: row.returnCargoSpaceEmpty,
        tonnageEmpty: row.returnTonnageEmpty,
        onlySameDirection: row.returnOnlySameDirection,
        loadCriteria: row.returnLoadCriteria,
        loadAtStops: row.loadAtStops
          .filter((l) => l.direction === 'return')
          .map((l) => ({
            routeStopIndex: l.routeStopIndex,
            fillPercent: l.fillPercent,
            tonnageKg: l.tonnageKg,
            cargoM3: l.cargoM3,
            loadCriteria: l.loadCriteria,
          })),
        surroundingLoads: row.surroundingLoads.map((s) => ({
          province: s.province,
          district: s.district,
          sortOrder: s.sortOrder,
        })),
      },
      acceptedTermsAt: row.acceptedTermsAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private findById(id: string) {
    return this.prisma.freightShipment.findUnique({
      where: { id },
      include: {
        routeStops: { orderBy: { sortOrder: 'asc' } },
        returnRouteStops: { orderBy: { sortOrder: 'asc' } },
        loadAtStops: { orderBy: [{ direction: 'asc' }, { routeStopIndex: 'asc' }] },
        surroundingLoads: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  async create(userId: string, dto: CreateFreightShipmentDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException('Şartlar ve koşullar kabul edilmelidir');
    }

    const startAt = new Date(dto.startAt);
    const vehicleReturnAt = new Date(dto.vehicleReturnAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(vehicleReturnAt.getTime())) {
      throw new BadRequestException('Geçersiz tarih veya saat');
    }
    if (vehicleReturnAt.getTime() < startAt.getTime()) {
      throw new BadRequestException('Dönüş zamanı başlangıçtan önce olamaz');
    }

    const organizationId = await this.resolveOrganizationId(userId);
    const routeLegsJson =
      dto.routeLegs?.map((l) => ({
        distanceKm: l.distanceKm,
        durationSeconds: l.durationSeconds,
      })) ?? [];
    const returnRouteLegsJson =
      dto.returnRouteLegs?.map((l) => ({
        distanceKm: l.distanceKm,
        durationSeconds: l.durationSeconds,
      })) ?? [];

    const shipment = await this.prisma.freightShipment.create({
      data: {
        userId,
        organizationId,
        status: FreightShipmentStatus.active,
        startProvince: dto.startProvince.trim(),
        startDistrict: dto.startDistrict.trim(),
        startAt,
        startBreakMinutes: dto.startBreakMinutes ?? 0,
        endProvince: dto.endProvince.trim(),
        endDistrict: dto.endDistrict.trim(),
        vehicleReturnAt,
        endRestMinutes: dto.endRestMinutes ?? 0,
        estimatedDistanceKm: dto.estimatedDistanceKm ?? null,
        estimatedDurationSeconds: dto.estimatedDurationSeconds ?? null,
        estimatedRouteFromLabel: dto.estimatedRouteFromLabel?.trim() || null,
        estimatedRouteToLabel: dto.estimatedRouteToLabel?.trim() || null,
        routeLegsJson,
        returnStartProvince: dto.returnStartProvince.trim(),
        returnStartDistrict: dto.returnStartDistrict.trim(),
        returnEndProvince: dto.returnEndProvince.trim(),
        returnEndDistrict: dto.returnEndDistrict.trim(),
        returnStartBreakMinutes: dto.returnStartBreakMinutes ?? 0,
        returnEstimatedDistanceKm: dto.returnEstimatedDistanceKm ?? null,
        returnEstimatedDurationSeconds: dto.returnEstimatedDurationSeconds ?? null,
        returnEstimatedRouteFromLabel:
          dto.returnEstimatedRouteFromLabel?.trim() || null,
        returnEstimatedRouteToLabel:
          dto.returnEstimatedRouteToLabel?.trim() || null,
        returnRouteLegsJson,
        outboundHasLoad: dto.outboundHasLoad?.trim() || null,
        outboundLoadStatus: dto.outboundLoadStatus?.trim() || null,
        outboundCanTakeExtraLoad: dto.outboundCanTakeExtraLoad?.trim() || null,
        outboundLoadDescription: dto.outboundLoadDescription?.trim() || null,
        outboundFillPercent: dto.outboundFillPercent?.trim() || null,
        outboundTonnageFullness: dto.outboundTonnageFullness?.trim() || null,
        outboundCargoSpaceEmpty: dto.outboundCargoSpaceEmpty?.trim() || null,
        outboundTonnageEmpty: dto.outboundTonnageEmpty?.trim() || null,
        outboundLoadCriteria: dto.outboundLoadCriteria?.trim() || null,
        returnHasLoad: dto.returnHasLoad?.trim() || null,
        returnLoadStatus: dto.returnLoadStatus?.trim() || null,
        returnLoadDescription: dto.returnLoadDescription?.trim() || null,
        returnCanTakeExtraLoad: dto.returnCanTakeExtraLoad?.trim() || null,
        returnFillPercent: dto.returnFillPercent?.trim() || null,
        returnTonnageFullness: dto.returnTonnageFullness?.trim() || null,
        returnCargoSpaceEmpty: dto.returnCargoSpaceEmpty?.trim() || null,
        returnTonnageEmpty: dto.returnTonnageEmpty?.trim() || null,
        returnOnlySameDirection: dto.returnOnlySameDirection?.trim() || null,
        returnLoadCriteria: dto.returnLoadCriteria?.trim() || null,
        acceptedTermsAt: new Date(),
        routeStops: {
          create: dto.routeStops.map((s, i) => ({
            sortOrder: i,
            province: s.province.trim(),
            district: s.district.trim(),
            breakMinutes: s.breakMinutes ?? 0,
          })),
        },
        returnRouteStops: {
          create: dto.returnRouteStops.map((s, i) => ({
            sortOrder: i,
            province: s.province.trim(),
            district: s.district.trim(),
            breakMinutes: s.breakMinutes ?? 0,
          })),
        },
        loadAtStops: {
          create: [
            ...(dto.outboundLoadAtStops ?? []).map((l) => ({
              direction: 'outbound',
              routeStopIndex: l.routeStopIndex,
              fillPercent: l.fillPercent?.trim() || null,
              tonnageKg: l.tonnageKg?.trim() || null,
              cargoM3: l.cargoM3?.trim() || null,
              loadCriteria: l.loadCriteria?.trim() || null,
            })),
            ...(dto.returnLoadAtStops ?? []).map((l) => ({
              direction: 'return',
              routeStopIndex: l.routeStopIndex,
              fillPercent: l.fillPercent?.trim() || null,
              tonnageKg: l.tonnageKg?.trim() || null,
              cargoM3: l.cargoM3?.trim() || null,
              loadCriteria: l.loadCriteria?.trim() || null,
            })),
          ],
        },
        surroundingLoads: {
          create: (dto.returnSurroundingLoads ?? []).map((s, i) => ({
            sortOrder: i,
            province: s.province.trim(),
            district: s.district.trim(),
          })),
        },
      },
    });

    const full = await this.findById(shipment.id);
    return this.mapShipment(full);
  }

  async listMine(userId: string) {
    const organizationId = await this.resolveOrganizationId(userId);
    const rows = await this.prisma.freightShipment.findMany({
      where: organizationId
        ? {
            OR: [{ userId }, { organizationId }],
          }
        : { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        routeStops: { orderBy: { sortOrder: 'asc' } },
        returnRouteStops: { orderBy: { sortOrder: 'asc' } },
        loadAtStops: true,
        surroundingLoads: { orderBy: { sortOrder: 'asc' } },
      },
    });
    return rows.map((r) => this.mapShipment(r)!);
  }

  async getMine(userId: string, id: string) {
    const row = await this.findById(id);
    if (!row || row.userId !== userId) return null;
    return this.mapShipment(row);
  }

  private buildScalarData(dto: CreateFreightShipmentDto, startAt: Date, vehicleReturnAt: Date) {
    const routeLegsJson =
      dto.routeLegs?.map((l) => ({
        distanceKm: l.distanceKm,
        durationSeconds: l.durationSeconds,
      })) ?? [];
    const returnRouteLegsJson =
      dto.returnRouteLegs?.map((l) => ({
        distanceKm: l.distanceKm,
        durationSeconds: l.durationSeconds,
      })) ?? [];

    return {
      startProvince: dto.startProvince.trim(),
      startDistrict: dto.startDistrict.trim(),
      startAt,
      startBreakMinutes: dto.startBreakMinutes ?? 0,
      endProvince: dto.endProvince.trim(),
      endDistrict: dto.endDistrict.trim(),
      vehicleReturnAt,
      endRestMinutes: dto.endRestMinutes ?? 0,
      estimatedDistanceKm: dto.estimatedDistanceKm ?? null,
      estimatedDurationSeconds: dto.estimatedDurationSeconds ?? null,
      estimatedRouteFromLabel: dto.estimatedRouteFromLabel?.trim() || null,
      estimatedRouteToLabel: dto.estimatedRouteToLabel?.trim() || null,
      routeLegsJson,
      returnStartProvince: dto.returnStartProvince.trim(),
      returnStartDistrict: dto.returnStartDistrict.trim(),
      returnEndProvince: dto.returnEndProvince.trim(),
      returnEndDistrict: dto.returnEndDistrict.trim(),
      returnStartBreakMinutes: dto.returnStartBreakMinutes ?? 0,
      returnEstimatedDistanceKm: dto.returnEstimatedDistanceKm ?? null,
      returnEstimatedDurationSeconds: dto.returnEstimatedDurationSeconds ?? null,
      returnEstimatedRouteFromLabel:
        dto.returnEstimatedRouteFromLabel?.trim() || null,
      returnEstimatedRouteToLabel:
        dto.returnEstimatedRouteToLabel?.trim() || null,
      returnRouteLegsJson,
      outboundHasLoad: dto.outboundHasLoad?.trim() || null,
      outboundLoadStatus: dto.outboundLoadStatus?.trim() || null,
      outboundCanTakeExtraLoad: dto.outboundCanTakeExtraLoad?.trim() || null,
      outboundLoadDescription: dto.outboundLoadDescription?.trim() || null,
      outboundFillPercent: dto.outboundFillPercent?.trim() || null,
      outboundTonnageFullness: dto.outboundTonnageFullness?.trim() || null,
      outboundCargoSpaceEmpty: dto.outboundCargoSpaceEmpty?.trim() || null,
      outboundTonnageEmpty: dto.outboundTonnageEmpty?.trim() || null,
      outboundLoadCriteria: dto.outboundLoadCriteria?.trim() || null,
      returnHasLoad: dto.returnHasLoad?.trim() || null,
      returnLoadStatus: dto.returnLoadStatus?.trim() || null,
      returnLoadDescription: dto.returnLoadDescription?.trim() || null,
      returnCanTakeExtraLoad: dto.returnCanTakeExtraLoad?.trim() || null,
      returnFillPercent: dto.returnFillPercent?.trim() || null,
      returnTonnageFullness: dto.returnTonnageFullness?.trim() || null,
      returnCargoSpaceEmpty: dto.returnCargoSpaceEmpty?.trim() || null,
      returnTonnageEmpty: dto.returnTonnageEmpty?.trim() || null,
      returnOnlySameDirection: dto.returnOnlySameDirection?.trim() || null,
      returnLoadCriteria: dto.returnLoadCriteria?.trim() || null,
    };
  }

  private childCreates(dto: CreateFreightShipmentDto) {
    return {
      routeStops: dto.routeStops.map((s, i) => ({
        sortOrder: i,
        province: s.province.trim(),
        district: s.district.trim(),
        breakMinutes: s.breakMinutes ?? 0,
      })),
      returnRouteStops: dto.returnRouteStops.map((s, i) => ({
        sortOrder: i,
        province: s.province.trim(),
        district: s.district.trim(),
        breakMinutes: s.breakMinutes ?? 0,
      })),
      loadAtStops: [
        ...(dto.outboundLoadAtStops ?? []).map((l) => ({
          direction: 'outbound',
          routeStopIndex: l.routeStopIndex,
          fillPercent: l.fillPercent?.trim() || null,
          tonnageKg: l.tonnageKg?.trim() || null,
          cargoM3: l.cargoM3?.trim() || null,
          loadCriteria: l.loadCriteria?.trim() || null,
        })),
        ...(dto.returnLoadAtStops ?? []).map((l) => ({
          direction: 'return',
          routeStopIndex: l.routeStopIndex,
          fillPercent: l.fillPercent?.trim() || null,
          tonnageKg: l.tonnageKg?.trim() || null,
          cargoM3: l.cargoM3?.trim() || null,
          loadCriteria: l.loadCriteria?.trim() || null,
        })),
      ],
      surroundingLoads: (dto.returnSurroundingLoads ?? []).map((s, i) => ({
        sortOrder: i,
        province: s.province.trim(),
        district: s.district.trim(),
      })),
    };
  }

  async updateMine(userId: string, id: string, dto: CreateFreightShipmentDto) {
    if (!dto.acceptedTerms) {
      throw new BadRequestException('Şartlar ve koşullar kabul edilmelidir');
    }

    const existing = await this.prisma.freightShipment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const startAt = new Date(dto.startAt);
    const vehicleReturnAt = new Date(dto.vehicleReturnAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(vehicleReturnAt.getTime())) {
      throw new BadRequestException('Geçersiz tarih veya saat');
    }
    if (vehicleReturnAt.getTime() < startAt.getTime()) {
      throw new BadRequestException('Dönüş zamanı başlangıçtan önce olamaz');
    }

    const scalar = this.buildScalarData(dto, startAt, vehicleReturnAt);
    const children = this.childCreates(dto);

    await this.prisma.$transaction(async (tx) => {
      await tx.freightShipmentRouteStop.deleteMany({ where: { shipmentId: id } });
      await tx.freightShipmentReturnRouteStop.deleteMany({ where: { shipmentId: id } });
      await tx.freightShipmentLoadAtStop.deleteMany({ where: { shipmentId: id } });
      await tx.freightShipmentSurroundingLoad.deleteMany({ where: { shipmentId: id } });

      await tx.freightShipment.update({
        where: { id },
        data: {
          ...scalar,
          acceptedTermsAt: new Date(),
          routeStops: { create: children.routeStops },
          returnRouteStops: { create: children.returnRouteStops },
          loadAtStops: { create: children.loadAtStops },
          surroundingLoads: { create: children.surroundingLoads },
        },
      });
    });

    const full = await this.findById(id);
    return this.mapShipment(full);
  }

  private estimatedArrivalAt(
    row: {
      startAt: Date;
      estimatedDurationSeconds: number | null;
      startBreakMinutes: number;
      routeLegsJson: unknown;
      routeStops: { breakMinutes: number }[];
    },
  ): Date | null {
    let routeSec = row.estimatedDurationSeconds ?? 0;
    if (routeSec <= 0) {
      const legs = row.routeLegsJson as { durationSeconds?: number }[] | null;
      if (Array.isArray(legs)) {
        routeSec = legs.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0);
      }
    }
    if (routeSec <= 0) return null;

    let breakSec = (row.startBreakMinutes ?? 0) * 60;
    for (const s of row.routeStops) {
      breakSec += (s.breakMinutes ?? 0) * 60;
    }
    return new Date(row.startAt.getTime() + (routeSec + breakSec) * 1000);
  }

  async deleteMine(userId: string, id: string): Promise<boolean> {
    const row = await this.prisma.freightShipment.findUnique({
      where: { id },
      include: { routeStops: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row || row.userId !== userId) {
      return false;
    }
    if (row.status === FreightShipmentStatus.completed) {
      throw new BadRequestException('Tamamlanan nakliye silinemez');
    }
    const arrival = this.estimatedArrivalAt(row);
    if (arrival && arrival.getTime() <= Date.now()) {
      throw new BadRequestException('Süresi dolmuş nakliye silinemez');
    }

    await this.prisma.freightShipment.delete({ where: { id } });
    return true;
  }
}
