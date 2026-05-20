/**
 * Excel/CSV → district_distances (5 sütun, tablo ile aynı)
 * npm run import:distances -- /tmp/mesafeler.csv
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();
const BATCH = 5000;

const DDL = `
DROP TABLE IF EXISTS public.district_distances CASCADE;
CREATE TABLE public.district_distances (
    kalkis_il TEXT NOT NULL,
    kalkis_ilce TEXT NOT NULL,
    varis_il TEXT NOT NULL,
    varis_ilce TEXT NOT NULL,
    km NUMERIC(10,2) NOT NULL
);
CREATE INDEX idx_dist_lookup ON public.district_distances (
    upper(kalkis_il), upper(kalkis_ilce), upper(varis_il), upper(varis_ilce)
);
`;

function isHeader(first: string): boolean {
  const f = first.toLowerCase();
  return f.includes('kalk') || f === 'il';
}

function parseKm(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '')
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');
  return Number.parseFloat(s);
}

function readRows(filePath: string): string[][] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    const text = fs.readFileSync(filePath, 'utf8');
    const delim = text.includes(';') ? ';' : ',';
    return text
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => l.split(delim).map((c) => c.trim()));
  }
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('npm run import:distances -- /tmp/mesafeler.csv');
    process.exit(1);
  }
  const filePath = path.resolve(file);
  const all = readRows(filePath);
  let start = 0;
  if (all.length && isHeader(String(all[0][0] ?? ''))) start = 1;

  const values: string[] = [];
  for (let i = start; i < all.length; i++) {
    const r = all[i];
    if (r.length < 5) continue;
    const km = parseKm(r[4]);
    if (!Number.isFinite(km)) continue;
    const esc = (s: string) => s.replace(/'/g, "''").trim();
    values.push(
      `('${esc(r[0])}','${esc(r[1])}','${esc(r[2])}','${esc(r[3])}',${km})`,
    );
  }

  console.log(`Satır: ${values.length}`);
  await prisma.$executeRawUnsafe(DDL);

  for (let i = 0; i < values.length; i += BATCH) {
    const chunk = values.slice(i, i + BATCH).join(',');
    await prisma.$executeRawUnsafe(
      `INSERT INTO district_distances (kalkis_il,kalkis_ilce,varis_il,varis_ilce,km) VALUES ${chunk}`,
    );
    console.log(`${Math.min(i + BATCH, values.length)} / ${values.length}`);
  }

  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count FROM district_distances
  `;
  console.log(`TAMAM: ${rows[0].count} kayıt`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
