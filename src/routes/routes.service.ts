import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EstimateRouteDto } from './dto/estimate-route.dto';
import { RoutePointDto } from './dto/route-point.dto';

/** OSRM — ücretsiz karayolu mesafesi (VDS veya kendi sunucunuz). */
const DEFAULT_OSRM_BASE = 'https://router.project-osrm.org';

export type RouteEstimateResponse = {
  cached: boolean;
  distanceKm: number;
  durationSeconds: number;
  encodedPolyline: string | null;
  fromLabel: string;
  toLabel: string;
};

@Injectable()
export class RoutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  osrmBaseUrl(): string {
    const raw =
      this.config.get<string>('OSRM_BASE_URL')?.trim() || DEFAULT_OSRM_BASE;
    return raw.replace(/\/$/, '');
  }

  isRoutesConfigured(): boolean {
    return this.osrmBaseUrl().length > 0;
  }

  async estimate(dto: EstimateRouteDto): Promise<RouteEstimateResponse> {
    const originAddress =
      dto.start.address?.trim() || dto.start.label.trim();
    const destinationAddress =
      dto.end.address?.trim() || dto.end.label.trim();
    const routeKey = this.buildRouteKey(dto);

    try {
      const cached = await this.prisma.routeDistanceCache.findUnique({
        where: { routeKey },
      });

      if (cached) {
        await this.prisma.routeDistanceCache.update({
          where: { routeKey },
          data: {
            lastUsedAt: new Date(),
            hitCount: { increment: 1 },
          },
        });

        return this.toResponse(cached, true, dto);
      }

      const osrm = await this.fetchFromOsrm(dto);

      const again = await this.prisma.routeDistanceCache.findUnique({
        where: { routeKey },
      });

      if (!again) {
        await this.prisma.routeDistanceCache.create({
          data: {
            routeKey,
            startProvince: '-',
            startDistrict: '-',
            endProvince: '-',
            endDistrict: '-',
            originAddress,
            destinationAddress,
            originLat: dto.start.lat,
            originLng: dto.start.lng,
            destinationLat: dto.end.lat,
            destinationLng: dto.end.lng,
            distanceMeters: osrm.distanceMeters,
            durationSeconds: osrm.durationSeconds,
            encodedPolyline: osrm.encodedPolyline,
          },
        });
      }

      return {
        cached: false,
        distanceKm: osrm.distanceMeters / 1000,
        durationSeconds: osrm.durationSeconds,
        encodedPolyline: osrm.encodedPolyline,
        fromLabel: dto.start.label.trim(),
        toLabel: dto.end.label.trim(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('route_distance_cache')) {
        throw new ServiceUnavailableException(
          'route_distance_cache tablosu yok. database/logimap/010_route_distance_cache.sql çalıştırın.',
        );
      }
      throw err;
    }
  }

  private toResponse(
    row: {
      distanceMeters: number;
      durationSeconds: number;
      encodedPolyline: string | null;
    },
    cached: boolean,
    dto: EstimateRouteDto,
  ): RouteEstimateResponse {
    return {
      cached,
      distanceKm: row.distanceMeters / 1000,
      durationSeconds: row.durationSeconds,
      encodedPolyline: row.encodedPolyline,
      fromLabel: dto.start.label.trim(),
      toLabel: dto.end.label.trim(),
    };
  }

  private coordKey(lat: number, lng: number): string {
    return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  }

  buildRouteKey(dto: EstimateRouteDto): string {
    const segments: string[] = [this.pointKey(dto.start)];

    for (const w of dto.intermediates ?? []) {
      segments.push(this.pointKey(w));
    }

    segments.push(this.pointKey(dto.end));

    return createHash('sha256').update(segments.join('->')).digest('hex');
  }

  private pointKey(p: RoutePointDto): string {
    return this.coordKey(p.lat, p.lng);
  }

  /** OSRM koordinat sırası: lon,lat */
  private buildOsrmCoordinatePath(dto: EstimateRouteDto): string {
    const points: RoutePointDto[] = [
      dto.start,
      ...(dto.intermediates ?? []),
      dto.end,
    ];
    return points.map((p) => `${p.lng},${p.lat}`).join(';');
  }

  private async fetchFromOsrm(dto: EstimateRouteDto): Promise<{
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string | null;
  }> {
    const base = this.osrmBaseUrl();
    const path = this.buildOsrmCoordinatePath(dto);
    const url =
      `${base}/route/v1/driving/${path}` +
      '?overview=full&geometries=polyline&alternatives=false&steps=false';

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadGatewayException(
        `OSRM rota hatası (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = JSON.parse(text) as {
      code?: string;
      message?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: string;
      }>;
    };

    if (json.code && json.code !== 'Ok') {
      throw new BadGatewayException(
        `OSRM: ${json.message ?? json.code}`,
      );
    }

    const route = json.routes?.[0];
    const distance = route?.distance;
    const duration = route?.duration;

    if (distance == null || duration == null) {
      throw new BadGatewayException('OSRM yanıtı eksik (mesafe/süre).');
    }

    return {
      distanceMeters: Math.round(distance),
      durationSeconds: Math.round(duration),
      encodedPolyline: route?.geometry ?? null,
    };
  }
}
