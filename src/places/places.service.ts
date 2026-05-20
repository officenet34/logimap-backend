import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Nominatim — OSM adres arama (Türkçe uyumlu, ücretsiz, VDS üzerinden). */
const DEFAULT_NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export type PlaceSuggestion = {
  placeId: string | null;
  displayLabel: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  fromCache: boolean;
};

export type ResolvedPlace = {
  placeId: string | null;
  displayLabel: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  fromCache: boolean;
};

type NominatimAddress = {
  road?: string;
  house_number?: string;
  suburb?: string;
  town?: string;
  city?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimResult = {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

@Injectable()
export class PlacesService {
  /** Nominatim kullanım politikası: en fazla ~1 istek/saniye (public sunucu). */
  private static lastNominatimAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  nominatimBaseUrl(): string {
    const raw =
      this.config.get<string>('NOMINATIM_BASE_URL')?.trim() ||
      DEFAULT_NOMINATIM_BASE;
    return raw.replace(/\/$/, '');
  }

  private nominatimUserAgent(): string {
    return (
      this.config.get<string>('NOMINATIM_USER_AGENT')?.trim() ||
      'LogiMap/1.0 (https://logimap.com.tr; destek@logimap.com.tr)'
    );
  }

  normalizeSearchKey(query: string): string {
    return query
      .trim()
      .toLocaleLowerCase('tr-TR')
      .replace(/\s+/g, ' ');
  }

  async autocomplete(query: string): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    const searchKey = this.normalizeSearchKey(q);
    const fromDb = await this.searchCache(searchKey, q);
    const seen = new Set<string>();
    const merged: PlaceSuggestion[] = [];

    for (const row of fromDb) {
      const key = row.placeId ?? row.formattedAddress;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }

    if (merged.length >= 8) {
      return merged.slice(0, 8);
    }

    const fromNominatim = await this.fetchAutocompleteFromNominatim(q);
    for (const item of fromNominatim) {
      const key = item.placeId ?? item.formattedAddress;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= 8) break;
    }

    return merged;
  }

  async resolve(
    placeId: string,
    coords?: {
      lat: number;
      lng: number;
      displayLabel?: string;
      formattedAddress?: string;
    },
  ): Promise<ResolvedPlace> {
    const pid = placeId.trim();
    if (!pid) {
      throw new ServiceUnavailableException('placeId gerekli');
    }

    const cached = await this.prisma.addressGeocodeCache.findUnique({
      where: { placeId: pid },
    });

    if (cached) {
      await this.prisma.addressGeocodeCache.update({
        where: { placeId: pid },
        data: {
          lastUsedAt: new Date(),
          hitCount: { increment: 1 },
        },
      });
      return {
        placeId: cached.placeId,
        displayLabel: cached.displayLabel,
        formattedAddress: cached.formattedAddress,
        latitude: cached.latitude,
        longitude: cached.longitude,
        fromCache: true,
      };
    }

    if (coords?.lat != null && coords?.lng != null) {
      const display =
        coords.displayLabel?.trim() || coords.formattedAddress?.trim() || pid;
      const formatted = coords.formattedAddress?.trim() || display;
      await this.upsertCache({
        placeId: pid,
        formattedAddress: formatted,
        displayLabel: display,
        latitude: coords.lat,
        longitude: coords.lng,
        searchKey: this.normalizeSearchKey(display),
      });
      return {
        placeId: pid,
        displayLabel: display,
        formattedAddress: formatted,
        latitude: coords.lat,
        longitude: coords.lng,
        fromCache: false,
      };
    }

    throw new BadGatewayException(
      'Adres koordinatı eksik. Listeden tekrar seçin.',
    );
  }

  private async searchCache(
    searchKey: string,
    rawQuery: string,
  ): Promise<PlaceSuggestion[]> {
    try {
      const rows = await this.prisma.addressGeocodeCache.findMany({
        where: {
          OR: [
            { searchKey: { startsWith: searchKey } },
            { formattedAddress: { contains: rawQuery, mode: 'insensitive' } },
            { displayLabel: { contains: rawQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ hitCount: 'desc' }, { lastUsedAt: 'desc' }],
        take: 8,
      });

      return rows.map((r: (typeof rows)[number]) => ({
        placeId: r.placeId,
        displayLabel: r.displayLabel,
        formattedAddress: r.formattedAddress,
        latitude: r.latitude,
        longitude: r.longitude,
        fromCache: true,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('address_geocode_cache')) {
        throw new ServiceUnavailableException(
          'address_geocode_cache tablosu yok. database/logimap/011_address_geocode_cache.sql çalıştırın.',
        );
      }
      throw err;
    }
  }

  private async upsertCache(data: {
    placeId: string;
    formattedAddress: string;
    displayLabel: string;
    latitude: number;
    longitude: number;
    searchKey: string;
  }): Promise<void> {
    await this.prisma.addressGeocodeCache.upsert({
      where: { placeId: data.placeId },
      create: {
        placeId: data.placeId,
        formattedAddress: data.formattedAddress,
        displayLabel: data.displayLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        searchKey: data.searchKey,
      },
      update: {
        formattedAddress: data.formattedAddress,
        displayLabel: data.displayLabel,
        latitude: data.latitude,
        longitude: data.longitude,
        searchKey: data.searchKey,
        lastUsedAt: new Date(),
      },
    });
  }

  private async waitNominatimRateLimit(): Promise<void> {
    const minGapMs = 1100;
    const now = Date.now();
    const wait = PlacesService.lastNominatimAt + minGapMs - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    PlacesService.lastNominatimAt = Date.now();
  }

  private async fetchAutocompleteFromNominatim(
    input: string,
  ): Promise<PlaceSuggestion[]> {
    await this.waitNominatimRateLimit();

    const base = this.nominatimBaseUrl();
    const params = new URLSearchParams({
      q: input,
      format: 'json',
      addressdetails: '1',
      limit: '8',
      countrycodes: 'tr',
    });

    const res = await fetch(`${base}/search?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'tr',
        'User-Agent': this.nominatimUserAgent(),
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadGatewayException(
        `Nominatim adres arama hatası (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = JSON.parse(text) as NominatimResult[];
    if (!Array.isArray(json)) return [];

    const out: PlaceSuggestion[] = [];

    for (const row of json) {
      const lat = Number.parseFloat(row.lat ?? '');
      const lng = Number.parseFloat(row.lon ?? '');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const formatted = row.display_name?.trim() ?? '';
      const { displayLabel } = this.formatNominatimAddress(
        formatted,
        row.address,
      );
      const placeId =
        row.place_id != null ? `nominatim:${row.place_id}` : null;

      if (!displayLabel && !formatted) continue;

      out.push({
        placeId,
        displayLabel: displayLabel || formatted,
        formattedAddress: formatted || displayLabel,
        latitude: lat,
        longitude: lng,
        fromCache: false,
      });
    }

    return out;
  }

  private formatNominatimAddress(
    displayName: string,
    addr?: NominatimAddress,
  ): { displayLabel: string; formattedAddress: string } {
    if (!addr) {
      const short = this.shortDisplayName(displayName);
      return { displayLabel: short, formattedAddress: displayName || short };
    }

    const parts: string[] = [];
    const seen = new Set<string>();
    const add = (v?: string) => {
      if (!v) return;
      const k = v.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      parts.push(v);
    };

    if (addr.road) {
      add(
        addr.house_number
          ? `${addr.road} ${addr.house_number}`
          : addr.road,
      );
    }
    add(addr.suburb);
    add(addr.town ?? addr.village ?? addr.city);
    add(addr.county);
    add(addr.state);

    const formatted = parts.join(', ') || displayName;
    const display = formatted || this.shortDisplayName(displayName);

    return { displayLabel: display, formattedAddress: formatted };
  }

  /** Uzun display_name → kısa etiket (liste görünümü). */
  private shortDisplayName(full: string): string {
    const parts = full.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 3) return full;
    return parts.slice(0, 3).join(', ');
  }
}
