import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const PLACES_AUTOCOMPLETE_URL =
  'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';

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

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

    const fromGoogle = await this.fetchAutocompleteFromGoogle(q);
    for (const g of fromGoogle) {
      const key = g.placeId ?? g.formattedAddress;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(g);
      if (merged.length >= 8) break;
    }

    return merged;
  }

  async resolve(placeId: string): Promise<ResolvedPlace> {
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

    const google = await this.fetchPlaceDetailsFromGoogle(pid);
    await this.upsertCache({
      placeId: pid,
      formattedAddress: google.formattedAddress,
      displayLabel: google.displayLabel,
      latitude: google.latitude,
      longitude: google.longitude,
      searchKey: this.normalizeSearchKey(google.displayLabel),
    });

    return { ...google, placeId: pid, fromCache: false };
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

      return rows.map((r) => ({
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

  private resolveApiKey(): string {
    const key =
      this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim() ||
      this.config.get<string>('GOOGLE_ROUTES_API_KEY')?.trim() ||
      '';
    if (!key || key.includes('BURAYA')) {
      throw new ServiceUnavailableException(
        'GOOGLE_ROUTES_API_KEY veya GOOGLE_PLACES_API_KEY sunucuda tanımlı değil.',
      );
    }
    return key;
  }

  private async fetchAutocompleteFromGoogle(
    input: string,
  ): Promise<PlaceSuggestion[]> {
    const apiKey = this.resolveApiKey();

    const res = await fetch(PLACES_AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['tr'],
        languageCode: 'tr',
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadGatewayException(
        `Google Places autocomplete hatası (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = JSON.parse(text) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
        };
      }>;
    };

    const out: PlaceSuggestion[] = [];
    for (const s of json.suggestions ?? []) {
      const pred = s.placePrediction;
      const pid = pred?.placeId?.trim();
      const label = pred?.text?.text?.trim();
      if (!pid || !label) continue;
      out.push({
        placeId: pid,
        displayLabel: label,
        formattedAddress: label,
        latitude: null,
        longitude: null,
        fromCache: false,
      });
    }
    return out;
  }

  private async fetchPlaceDetailsFromGoogle(placeId: string): Promise<{
    displayLabel: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
  }> {
    const apiKey = this.resolveApiKey();
    const url = `${PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,formattedAddress,location,displayName',
      },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadGatewayException(
        `Google Place details hatası (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = JSON.parse(text) as {
      formattedAddress?: string;
      displayName?: { text?: string };
      location?: { latitude?: number; longitude?: number };
    };

    const lat = json.location?.latitude;
    const lng = json.location?.longitude;
    if (lat == null || lng == null) {
      throw new BadGatewayException('Google Place koordinatı eksik.');
    }

    const formatted = json.formattedAddress?.trim() || '';
    const display =
      json.displayName?.text?.trim() || formatted || 'Seçilen adres';

    return {
      displayLabel: display,
      formattedAddress: formatted || display,
      latitude: lat,
      longitude: lng,
    };
  }
}
