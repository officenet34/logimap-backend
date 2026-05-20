/**
 * Excel/CSV → district_distances (Prisma + xlsx)
 *
 *   npm run import:distances -- /tmp/mesafeler.xlsx
 *
 * Tekrarlı kayıt: tablo UNIQUE'siz; Excel'deki çiftler script'te birleştirilir.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const BATCH = 5000;

const RESET_DDL = `
DROP TABLE IF EXISTS public.district_distances CASCADE;

CREATE TABLE public.district_distances (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    origin_province TEXT NOT NULL,
    origin_district TEXT NOT NULL,
    dest_province TEXT NOT NULL,
    dest_district TEXT NOT NULL,
    origin_province_norm TEXT NOT NULL,
    origin_district_norm TEXT NOT NULL,
    dest_province_norm TEXT NOT NULL,
    dest_district_norm TEXT NOT NULL,
    distance_km NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT district_distances_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_district_distances_lookup ON public.district_distances (
    origin_province_norm, origin_district_norm,
    dest_province_norm, dest_district_norm
);
`;

function norm(value: string): string {
  return value.trim().toLocaleUpperCase('tr-TR');
}

function routeKey(r: {
  originProvinceNorm: string;
  originDistrictNorm: string;
  destProvinceNorm: string;
  destDistrictNorm: string;
}): string {
  return `${r.originProvinceNorm}|${r.originDistrictNorm}|${r.destProvinceNorm}|${r.destDistrictNorm}`;
}

function isHeaderRow(cells: unknown[]): boolean {
  const first = String(cells[0] ?? '').toLowerCase();
  return first.includes('kalk') || first === 'il' || first === 'raw_line';
}

function parseKm(raw: unknown): number {
  if (raw == null || raw === '') throw new Error('boş km');
  if (typeof raw === 'number') return raw;
  const s = String(raw)
    .trim()
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) throw new Error(`km: ${raw}`);
  return n;
}

function rowToRecord(cells: unknown[]): Prisma.DistrictDistanceCreateManyInput | null {
  if (cells.length < 5) return null;
  const p1 = String(cells[0] ?? '').trim();
  const p2 = String(cells[1] ?? '').trim();
  const p3 = String(cells[2] ?? '').trim();
  const p4 = String(cells[3] ?? '').trim();
  if (!p1 || !p2 || !p3 || !p4) return null;
  const km = parseKm(cells[4]);
  return {
    originProvince: p1,
    originDistrict: p2,
    destProvince: p3,
    destDistrict: p4,
    originProvinceNorm: norm(p1),
    originDistrictNorm: norm(p2),
    destProvinceNorm: norm(p3),
    destDistrictNorm: norm(p4),
    distanceKm: new Prisma.Decimal(km.toFixed(2)),
  };
}

function readXlsx(filePath: string): Prisma.DistrictDistanceCreateManyInput[] {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  });
  const out: Prisma.DistrictDistanceCreateManyInput[] = [];
  let start = 0;
  if (rows.length > 0 && isHeaderRow(rows[0])) start = 1;

  for (let i = start; i < rows.length; i++) {
    try {
      const rec = rowToRecord(rows[i] as unknown[]);
      if (rec) out.push(rec);
    } catch (e) {
      console.warn(`Satır ${i + 1} atlandı:`, e);
    }
  }
  return out;
}

function readCsv(filePath: string): Prisma.DistrictDistanceCreateManyInput[] {
  const text = fs.readFileSync(filePath, 'utf8');
  const delim = text.includes(';') ? ';' : ',';
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: Prisma.DistrictDistanceCreateManyInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells =
      delim === ';' && !line.includes(',')
        ? line.split(';')
        : line.split(delim);
    if (i === 0 && isHeaderRow(cells)) continue;
    try {
      const rec = rowToRecord(cells);
      if (rec) out.push(rec);
    } catch (e) {
      console.warn(`Satır ${i + 1} atlandı:`, e);
    }
  }
  return out;
}

/** Aynı güzergah birden fazla satırdaysa son km değeri kalır. */
function dedupe(
  records: Prisma.DistrictDistanceCreateManyInput[],
): Prisma.DistrictDistanceCreateManyInput[] {
  const map = new Map<string, Prisma.DistrictDistanceCreateManyInput>();
  for (const r of records) {
    map.set(routeKey(r), r);
  }
  return [...map.values()];
}

async function main(): Promise<void> {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Kullanım: npm run import:distances -- /yol/mesafeler.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('Dosya yok:', filePath);
    process.exit(1);
  }

  const ext = path.extname(filePath).toLowerCase();
  console.log('Dosya:', filePath);

  const raw =
    ext === '.csv' ? readCsv(filePath) : readXlsx(filePath);

  if (raw.length === 0) {
    console.error('Hiç satır okunamadı');
    process.exit(1);
  }

  const records = dedupe(raw);
  const dupes = raw.length - records.length;
  console.log(`Okunan: ${raw.length} satır (${dupes} tekrar birleştirildi → ${records.length})`);

  console.log('Tablo sıfırlanıyor (UNIQUE yok)...');
  await prisma.$executeRawUnsafe(RESET_DDL);

  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    await prisma.districtDistance.createMany({ data: chunk });
    console.log(`  ${Math.min(i + BATCH, records.length)} / ${records.length}`);
  }

  const count = await prisma.districtDistance.count();
  console.log(`TAMAM: ${count} kayıt → district_distances`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
