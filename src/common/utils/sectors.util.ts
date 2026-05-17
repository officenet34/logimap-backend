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
    throw new Error('En az bir sektör seçilmelidir');
  }
  return [...new Set(filtered)];
}
