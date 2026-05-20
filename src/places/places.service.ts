import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/** Komoot Photon — OSM tabanlı adres arama (ücretsiz, VDS üzerinden). */
const DEFAULT_PHOTON_BASE = 'https://photon.komoot.io';

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

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
};

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  photonBaseUrl(): string {
    const raw =
      this.config.get<string>('PHOTON_BASE_URL')?.trim() ||
      DEFAULT_PHOTON_BASE;
    return raw.replace(/\/$/, '');
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

    const fromPhoton = await this.fetchAutocompleteFromPhoton(q);
    for (const p of fromPhoton) {
      const key = p.placeId ?? p.formattedAddress;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
      if (merged.length >= 8) break;
    }

    return merged;
  }

  /**
   * Seçilen adresi DB'ye yazar.
   * Photon önerisinde lat/lng varsa doğrudan kaydedilir (ek API yok).
   */
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

  private async fetchAutocompleteFromPhoton(
    input: string,
  ): Promise<PlaceSuggestion[]> {
    const base = this.photonBaseUrl();
    const params = new URLSearchParams({
      q: input,
      lang: 'tr',
      limit: '8',
      bbox: '25.66,35.81,44.82,42.11',
    });

    const res = await fetch(`${base}/api/?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await res.text();
    if (!res.ok) {
      throw new BadGatewayException(
        `Photon adres arama hatası (${res.status}): ${text.slice(0, 300)}`,
      );
    }

    const json = JSON.parse(text) as { features?: PhotonFeature[] };
    const out: PlaceSuggestion[] = [];

    for (const f of json.features ?? []) {
      const coords = f.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const lng = coords[0];
      const lat = coords[1];
      const props = f.properties ?? {};
      const { displayLabel, formattedAddress } = this.formatPhotonAddress(props);
      const placeId = this.photonPlaceId(props);

      if (!displayLabel) continue;

      out.push({
        placeId,
        displayLabel,
        formattedAddress,
        latitude: lat,
        longitude: lng,
        fromCache: false,
      });
    }

    return out;
  }

  private photonPlaceId(props: Record<string, unknown>): string {
    const osmType = props.osm_type?.toString();
    const osmId = props.osm_id?.toString();
    if (osmType && osmId) return `osm:${osmType}:${osmId}`;
    const name = props.name?.toString() ?? 'place';
    const lat = props.lat?.toString() ?? '';
    const lon = props.lon?.toString() ?? '';
    return `photon:${name}:${lat}:${lon}`;
  }

  private formatPhotonAddress(props: Record<string, unknown>): {
    displayLabel: string;
    formattedAddress: string;
  } {
    const name = props.name?.toString()?.trim();
    const street = props.street?.toString()?.trim();
    const housenumber = props.housenumber?.toString()?.trim();
    const district =
      props.district?.toString()?.trim() ||
      props.county?.toString()?.trim();
    const city =
      props.city?.toString()?.trim() ||
      props.locality?.toString()?.trim();
    const state = props.state?.toString()?.trim();
    const country = props.country?.toString()?.trim();

    const parts: string[] = [];
    const seen = new Set<string>();
    const add = (v?: string) => {
      if (!v) return;
      const k = v.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      parts.push(v);
    };

    if (street) {
      add(housenumber ? `${street} ${housenumber}` : street);
    } else if (name) {
      add(name);
    }
    add(district);
    add(city);
    add(state);
    if (country && country.toLowerCase() !== 'türkiye') {
      add(country);
    }

    const formatted = parts.join(', ');
    const display =
      formatted ||
      name ||
      city ||
      state ||
      'Adres';

    return { displayLabel: display, formattedAddress: formatted || display };
  }
}
