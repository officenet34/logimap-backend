import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstimateRouteDto } from './dto/estimate-route.dto';

/** XLS tablosundan süre tahmini (km başına ortalama kamyon hızı). */
const AVG_SPEED_KMH = 70;

/** Excel/DB il adı ↔ uygulama (tr_locations.json). */
const PROVINCE_ALIAS_GROUPS: readonly string[][] = [
  ['AFYON', 'AFYONKARAHİSAR', 'AFYONKARAHISAR'],
  ['K.MARAŞ', 'K.MARAS', 'KAHRAMANMARAŞ', 'KAHRAMANMARAS'],
];

export type RouteLegResponse = {
  distanceKm: number;
  durationSeconds: number;
};

export type RouteEstimateResponse = {
  cached: boolean;
  distanceKm: number;
  durationSeconds: number;
  legs: RouteLegResponse[];
  encodedPolyline: string | null;
  fromLabel: string;
  toLabel: string;
};

type Segment = {
  originProvince: string;
  originDistrict: string;
  destProvince: string;
  destDistrict: string;
};

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async estimate(dto: EstimateRouteDto): Promise<RouteEstimateResponse> {
    const segments = this.buildSegments(dto);
    const legs: RouteLegResponse[] = [];
    let totalKm = 0;

    for (const seg of segments) {
      const km = await this.lookupDistanceKm(seg);
      totalKm += km;
      legs.push({
        distanceKm: km,
        durationSeconds: Math.max(
          60,
          Math.round((km / AVG_SPEED_KMH) * 3600),
        ),
      });
    }

    const durationSeconds = legs.reduce((s, l) => s + l.durationSeconds, 0);

    return {
      cached: true,
      distanceKm: totalKm,
      durationSeconds,
      legs,
      encodedPolyline: null,
      fromLabel: this.placeLabel(dto.startDistrict, dto.startProvince),
      toLabel: this.placeLabel(dto.endDistrict, dto.endProvince),
    };
  }

  private buildSegments(dto: EstimateRouteDto): Segment[] {
    const waypoints: Array<{ district: string; province: string }> = [
      { district: dto.startDistrict, province: dto.startProvince },
      ...(dto.intermediates ?? []),
      { district: dto.endDistrict, province: dto.endProvince },
    ];

    const segments: Segment[] = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      segments.push({
        originProvince: a.province,
        originDistrict: a.district,
        destProvince: b.province,
        destDistrict: b.district,
      });
    }
    return segments;
  }

  private async lookupDistanceKm(seg: Segment): Promise<number> {
    const opKeys = this.provinceLookupKeys(seg.originProvince);
    const od = this.norm(seg.originDistrict);
    const dpKeys = this.provinceLookupKeys(seg.destProvince);
    const dd = this.norm(seg.destDistrict);

    try {
      for (const op of opKeys) {
        for (const dp of dpKeys) {
          const rows = await this.prisma.$queryRaw<Array<{ km: string | number }>>`
            SELECT km
            FROM public.district_distances
            WHERE upper(trim(kalkis_il)) = ${op}
              AND upper(trim(kalkis_ilce)) = ${od}
              AND upper(trim(varis_il)) = ${dp}
              AND upper(trim(varis_ilce)) = ${dd}
            LIMIT 1
          `;
          const row = rows[0];
          if (row) {
            const km = Number(row.km);
            if (!Number.isFinite(km) || km < 0) {
              throw new NotFoundException('Geçersiz mesafe kaydı.');
            }
            return km;
          }
        }
      }

      throw new NotFoundException(
        `Bu güzergah tabloda yok: ${seg.originDistrict}/${seg.originProvince} → ` +
          `${seg.destDistrict}/${seg.destProvince}.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('district_distances')) {
        throw new ServiceUnavailableException(
          'district_distances tablosu yok. database/logimap/district_distances.sql çalıştırın.',
        );
      }
      throw err;
    }
  }

  /** Uygulama (Adana) ve XLS (ADANA) ile uyumlu. */
  norm(value: string): string {
    return value.trim().toLocaleUpperCase('tr-TR');
  }

  private provinceLookupKeys(province: string): string[] {
    const n = this.norm(province);
    const keys = new Set<string>([n]);
    for (const group of PROVINCE_ALIAS_GROUPS) {
      const normalized = group.map((g) => this.norm(g));
      if (normalized.includes(n)) {
        normalized.forEach((k) => keys.add(k));
      }
    }
    return [...keys];
  }

  private placeLabel(district: string, province: string): string {
    const d = district.trim();
    const p = province.trim();
    if (!d) return p;
    if (!p) return d;
    return `${d}/${p}`;
  }
}

