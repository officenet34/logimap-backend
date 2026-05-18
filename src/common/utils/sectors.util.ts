import { BadRequestException } from '@nestjs/common';
import { SectorCode } from '@prisma/client';

const ALL_SECTORS: SectorCode[] = [
  SectorCode.transport_services,
  SectorCode.home_moving,
  SectorCode.cargo,
];

export function resolveSectors(input: (SectorCode | 'all')[]): SectorCode[] {
  if (input.includes('all')) {
    return [...ALL_SECTORS];
  }
  const filtered = input.filter((s): s is SectorCode => s !== 'all');
  if (!filtered.length) {
    throw new BadRequestException('En az bir sektör seçilmelidir');
  }
  return [...new Set(filtered)];
}

const SECTOR_LABELS: Record<SectorCode, string> = {
  [SectorCode.transport_services]: 'Nakliye',
  [SectorCode.home_moving]: 'Evden Eve Nakliye',
  [SectorCode.cargo]: 'Kargo',
};

const SECTOR_DISPLAY_ORDER: SectorCode[] = [
  SectorCode.home_moving,
  SectorCode.transport_services,
  SectorCode.cargo,
];

export function formatSectorLabels(codes: SectorCode[]): string {
  if (!codes.length) return '';
  const unique = [...new Set(codes)];
  const ordered = SECTOR_DISPLAY_ORDER.filter((c) => unique.includes(c));
  const labels = ordered.map((c) => SECTOR_LABELS[c]);
  if (labels.length === 1) return `${labels[0]}/ Nakliyat Hizmetleri`;
  return labels.join('/ ');
}
