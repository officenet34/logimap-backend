import { BadRequestException } from '@nestjs/common';

/** PostgreSQL sector_code enum — Prisma generate gerekmeden IDE/derleme uyumu */
export type SectorCodeValue =
  | 'transport_services'
  | 'home_moving'
  | 'cargo';

const ALL_SECTORS: SectorCodeValue[] = [
  'transport_services',
  'home_moving',
  'cargo',
];

export function resolveSectors(
  input: (SectorCodeValue | 'all')[],
): SectorCodeValue[] {
  if (input.includes('all')) {
    return [...ALL_SECTORS];
  }
  const filtered = input.filter((s): s is SectorCodeValue => s !== 'all');
  if (!filtered.length) {
    throw new BadRequestException('En az bir sektör seçilmelidir');
  }
  return [...new Set(filtered)];
}

const SECTOR_LABELS: Record<SectorCodeValue, string> = {
  transport_services: 'Nakliye',
  home_moving: 'Evden Eve Nakliye',
  cargo: 'Kargo',
};

const SECTOR_DISPLAY_ORDER: SectorCodeValue[] = [
  'home_moving',
  'transport_services',
  'cargo',
];

function orderedUnique(codes: readonly string[]): SectorCodeValue[] {
  const unique = new Set(
    codes.filter((c): c is SectorCodeValue =>
      (ALL_SECTORS as string[]).includes(c),
    ),
  );
  return SECTOR_DISPLAY_ORDER.filter((c) => unique.has(c));
}

/** Tek satır özet (geriye uyumluluk) */
export function formatSectorLabels(codes: readonly string[]): string {
  const lines = formatSectorLines(codes);
  return lines.join('/ ');
}

/** Her sektör ayrı satır — UI listesi */
export function formatSectorLines(codes: readonly string[]): string[] {
  const ordered = orderedUnique(codes);
  return ordered.map((c) => `${SECTOR_LABELS[c]}/ Nakliyat Hizmetleri`);
}
