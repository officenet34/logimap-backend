import {
  BadRequestException,
  Injectable,
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
}
