import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MapAlertKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGlobalMapAlertDto } from './dto/create-global-map-alert.dto';
import { UpdateGlobalMapAlertDto } from './dto/update-global-map-alert.dto';

@Injectable()
export class MapAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTtl(raw?: string): '24h' | 'forever' {
    const v = (raw ?? '24h').toLowerCase().trim();
    if (v === 'forever' || v === 'unlimited') return 'forever';
    if (v === '24h' || v === '24') return '24h';
    throw new BadRequestException('ttl sadece 24h veya forever olabilir');
  }

  async list() {
    const now = new Date();
    const rows = await this.prisma.globalMapAlert.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        kind: true,
        message: true,
        createdByUserId: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return { alerts: rows };
  }

  async create(userId: string, dto: CreateGlobalMapAlertDto) {
    const ttl = this.normalizeTtl(dto.ttl);
    const expiresAt =
      ttl === '24h' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const message = (dto.message ?? '').trim();

    const row = await this.prisma.globalMapAlert.create({
      data: {
        createdByUserId: userId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        kind: dto.kind as MapAlertKind,
        message,
        expiresAt,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        kind: true,
        message: true,
        createdByUserId: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return { alert: row };
  }

  async update(userId: string, alertId: string, dto: UpdateGlobalMapAlertDto) {
    const existing = await this.prisma.globalMapAlert.findUnique({
      where: { id: alertId },
    });
    if (!existing) throw new NotFoundException('Uyarı bulunamadı');
    if (existing.createdByUserId !== userId) {
      throw new ForbiddenException('Bu uyarıyı yalnızca ekleyen kullanıcı düzenleyebilir');
    }

    const row = await this.prisma.globalMapAlert.update({
      where: { id: alertId },
      data: {
        ...(dto.latitude != null ? { latitude: dto.latitude } : {}),
        ...(dto.longitude != null ? { longitude: dto.longitude } : {}),
        ...(dto.kind != null ? { kind: dto.kind } : {}),
        ...(dto.message !== undefined ? { message: dto.message.trim() } : {}),
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        kind: true,
        message: true,
        createdByUserId: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return { alert: row };
  }

  async remove(userId: string, alertId: string) {
    const existing = await this.prisma.globalMapAlert.findUnique({
      where: { id: alertId },
    });
    if (!existing) throw new NotFoundException('Uyarı bulunamadı');
    if (existing.createdByUserId !== userId) {
      throw new ForbiddenException('Bu uyarıyı yalnızca ekleyen kullanıcı silebilir');
    }
    await this.prisma.globalMapAlert.update({
      where: { id: alertId },
      data: { isActive: false },
    });
    return { success: true };
  }
}
