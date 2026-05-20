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

  isRoutesConfigured(): boolean {
    const key = this.config.get<string>('GOOGLE_ROUTES_API_KEY')?.trim() ?? '';
    return key.length > 0 && !key.includes('BURAYA_ROUTES');
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

      const google = await this.fetchFromGoogle(dto);

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

  private resolveRoutesApiKey(): string {
    const key = this.config.get<string>('GOOGLE_ROUTES_API_KEY')?.trim() ?? '';
    if (!key || key.includes('BURAYA_ROUTES')) {
      throw new ServiceUnavailableException(
        'GOOGLE_ROUTES_API_KEY sunucuda tanımlı değil. Coolify ortam değişkenine Routes API anahtarını ekleyip API servisini yeniden deploy edin.',
      );
    }
    return key;
  }

  private latLng(p: RoutePointDto) {
    return {
      location: {
        latLng: {
          latitude: p.lat,
          longitude: p.lng,
        },
      },
    };
  }

  private async fetchFromGoogle(dto: EstimateRouteDto): Promise<{
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string | null;
  }> {
    const apiKey = this.resolveRoutesApiKey();

    const body: Record<string, unknown> = {
      origin: this.latLng(dto.start),
      destination: this.latLng(dto.end),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      computeAlternativeRoutes: false,
      languageCode: 'tr-TR',
      units: 'METRIC',
    };

    const intermediates = dto.intermediates ?? [];
    if (intermediates.length > 0) {
      body.intermediates = intermediates.map((w) => this.latLng(w));
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
      if (
        res.status === 403 &&
        (detail.includes('Android client') || detail.includes('blocked'))
      ) {
        throw new BadGatewayException(
          'Google Routes 403: Coolify GOOGLE_ROUTES_API_KEY Android uygulama kısıtlı. ' +
            'Google Cloud\'da sunucu için YENİ anahtar oluşturun (Uygulama kısıtı: Yok, API: Routes API).',
        );
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
