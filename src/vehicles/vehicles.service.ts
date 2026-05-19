import { Injectable } from '@nestjs/common';
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
      ...scalar
    } = dto;

    const vehicle = await this.prisma.driverVehicle.upsert({
      where: { userId },
      create: {
        userId,
        ...scalar,
        plateTrailer: plateTrailer ?? null,
      },
      update: {
        ...scalar,
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
}
