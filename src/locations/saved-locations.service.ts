import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedLocationDto } from './dto/create-saved-location.dto';
import { UpdateSavedLocationDto } from './dto/update-saved-location.dto';

@Injectable()
export class SavedLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toApi(row: {
    id: string;
    userId: string;
    name: string;
    latitude: number;
    longitude: number;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      user_id: row.userId,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async listMine(userId: string) {
    const rows = await this.prisma.savedLocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { savedLocations: rows.map((r) => this.toApi(r)) };
  }

  async countMine(userId: string) {
    const count = await this.prisma.savedLocation.count({
      where: { userId },
    });
    return { count };
  }

  async createMine(userId: string, dto: CreateSavedLocationDto) {
    const name = dto.name.trim();
    const row = await this.prisma.savedLocation.create({
      data: {
        userId,
        name,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address?.trim() || null,
      },
    });
    return { savedLocation: this.toApi(row) };
  }

  async updateMine(
    userId: string,
    id: string,
    dto: UpdateSavedLocationDto,
  ) {
    const existing = await this.prisma.savedLocation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Kayıtlı konum bulunamadı');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException();
    }

    const row = await this.prisma.savedLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.address !== undefined
          ? { address: dto.address?.trim() || null }
          : {}),
      },
    });
    return { savedLocation: this.toApi(row) };
  }

  async deleteMine(userId: string, id: string) {
    const existing = await this.prisma.savedLocation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Kayıtlı konum bulunamadı');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException();
    }
    await this.prisma.savedLocation.delete({ where: { id } });
    return { success: true };
  }
}
