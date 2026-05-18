import { BadRequestException } from '@nestjs/common';

/** PostgreSQL sector_code enum */
export type SectorCodeValue =
  | 'transport_services'
  | 'home_moving'
  | 'cargo'
  | 'logistics';

const ALL_SECTORS: SectorCodeValue[] = [
  'transport_services',
  'home_moving',
  'cargo',
  'logistics',
];

/** Kayıt ekranı gösterim sırası */
const SECTOR_DISPLAY_ORDER: SectorCodeValue[] = [
  'transport_services',
  'home_moving',
  'cargo',
  'logistics',
];

const SECTOR_LABELS: Record<SectorCodeValue, string> = {
  transport_services: 'Nakliye',
  home_moving: 'Evden Eve Nakliye',
  cargo: 'Kargo',
  logistics: 'Lojistik',
};

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
  return formatSectorLines(codes).join(', ');
}

/** Her sektör ayrı satır — kayıt ekranı etiketleri, ek sonek yok */
export function formatSectorLines(codes: readonly string[]): string[] {
  const ordered = orderedUnique(codes);
  return ordered.map((c) => SECTOR_LABELS[c]);
}
