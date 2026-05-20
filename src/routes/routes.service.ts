import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EstimateRouteDto } from './dto/estimate-route.dto';

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK =
  'routes.distanceMeters,routes.staticDuration,routes.polyline.encodedPolyline';

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

  async estimate(dto: EstimateRouteDto): Promise<RouteEstimateResponse> {
    const originAddress = this.formatAddress(dto.startDistrict, dto.startProvince);
    const destinationAddress = this.formatAddress(dto.endDistrict, dto.endProvince);
    const routeKey = this.buildRouteKey(dto);

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

    const google = await this.fetchFromGoogle(dto, originAddress, destinationAddress);

    const again = await this.prisma.routeDistanceCache.findUnique({
      where: { routeKey },
    });

    if (!again) {
      await this.prisma.routeDistanceCache.create({
        data: {
          routeKey,
          startProvince: dto.startProvince.trim(),
          startDistrict: dto.startDistrict.trim(),
          endProvince: dto.endProvince.trim(),
          endDistrict: dto.endDistrict.trim(),
          originAddress,
          destinationAddress,
          distanceMeters: google.distanceMeters,
          durationSeconds: google.durationSeconds,
          encodedPolyline: google.encodedPolyline,
        },
      });
    }

    return {
      cached: false,
      distanceKm: google.distanceMeters / 1000,
      durationSeconds: google.durationSeconds,
      encodedPolyline: google.encodedPolyline,
      fromLabel: this.placeLabel(dto.startDistrict, dto.startProvince),
      toLabel: this.placeLabel(dto.endDistrict, dto.endProvince),
    };
  }

  private toResponse(
    row: {
      distanceMeters: number;
      durationSeconds: number;
      encodedPolyline: string | null;
      startDistrict: string;
      startProvince: string;
      endDistrict: string;
      endProvince: string;
    },
    cached: boolean,
    dto: EstimateRouteDto,
  ): RouteEstimateResponse {
    return {
      cached,
      distanceKm: row.distanceMeters / 1000,
      durationSeconds: row.durationSeconds,
      encodedPolyline: row.encodedPolyline,
      fromLabel: this.placeLabel(dto.startDistrict, dto.startProvince),
      toLabel: this.placeLabel(dto.endDistrict, dto.endProvince),
    };
  }

  private norm(value: string): string {
    return value.trim().toLocaleLowerCase('tr-TR');
  }

  private formatAddress(district: string, province: string): string {
    return `${district.trim()}, ${province.trim()}, Türkiye`;
  }

  private placeLabel(district: string, province: string): string {
    const d = district.trim();
    const p = province.trim();
    if (!d) return p;
    if (!p) return d;
    return `${d}/${p}`;
  }

  buildRouteKey(dto: EstimateRouteDto): string {
    const segments: string[] = [
      `${this.norm(dto.startDistrict)}|${this.norm(dto.startProvince)}`,
    ];

    for (const w of dto.intermediates ?? []) {
      segments.push(`${this.norm(w.district)}|${this.norm(w.province)}`);
    }

    segments.push(`${this.norm(dto.endDistrict)}|${this.norm(dto.endProvince)}`);

    return createHash('sha256').update(segments.join('->')).digest('hex');
  }

  private async fetchFromGoogle(
    dto: EstimateRouteDto,
    originAddress: string,
    destinationAddress: string,
  ): Promise<{
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string | null;
  }> {
    const apiKey = this.config.get<string>('GOOGLE_ROUTES_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GOOGLE_ROUTES_API_KEY sunucuda tanımlı değil (Coolify ortam değişkeni).',
      );
    }

    const body: Record<string, unknown> = {
      origin: { address: originAddress },
      destination: { address: destinationAddress },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'tr-TR',
      units: 'METRIC',
    };

    const intermediates = dto.intermediates ?? [];
    if (intermediates.length > 0) {
      body.intermediates = intermediates.map((w) => ({
        address: this.formatAddress(w.district, w.province),
      }));
    }

    const res = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 400);
      try {
        const json = JSON.parse(text) as { error?: { message?: string } };
        if (json.error?.message) detail = json.error.message;
      } catch {
        /* ignore */
      }
      throw new BadGatewayException(
        `Google Routes hatası (${res.status}): ${detail}`,
      );
    }

    const json = JSON.parse(text) as {
      routes?: Array<{
        distanceMeters?: number;
        staticDuration?: string | { seconds?: string };
        polyline?: { encodedPolyline?: string };
      }>;
    };

    const route = json.routes?.[0];
    const distanceMeters = route?.distanceMeters;
    const durationSeconds = this.parseDurationSeconds(route?.staticDuration);

    if (distanceMeters == null || durationSeconds == null) {
      throw new BadGatewayException('Google Routes yanıtı eksik (mesafe/süre).');
    }

    return {
      distanceMeters,
      durationSeconds,
      encodedPolyline: route?.polyline?.encodedPolyline ?? null,
    };
  }

  private parseDurationSeconds(
    raw: string | { seconds?: string } | undefined,
  ): number | null {
    if (raw == null) return null;
    if (typeof raw === 'object') {
      const s = raw.seconds;
      if (s != null) return this.parseDurationSeconds(s);
      return null;
    }
    const text = String(raw).trim();
    if (!text) return null;
    const n = text.endsWith('s') ? text.slice(0, -1) : text;
    const v = Number.parseFloat(n);
    return Number.isFinite(v) ? Math.round(v) : null;
  }
}
