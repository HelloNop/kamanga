// Impor lokasi dari CSV (hasil ekspor Excel / Google Sheets). Fungsi murni, tanpa database.
import { detectDelimiter, parseCsv } from '@/lib/csv';
import { slugify } from '@/lib/slug';

export const LEVELS = ['province', 'city', 'district', 'village', 'landmark'] as const;
export type Level = (typeof LEVELS)[number];

// Urutan tingkat: induk harus berada di tingkat yang lebih tinggi dari anak.
export const LEVEL_RANK: Record<Level, number> = {
  province: 0,
  city: 1,
  district: 2,
  village: 3,
  landmark: 4
};

// Istilah yang boleh dipakai di spreadsheet.
const LEVEL_ALIASES: Record<string, Level> = {
  province: 'province',
  provinsi: 'province',
  city: 'city',
  kota: 'city',
  kabupaten: 'city',
  'kota/kabupaten': 'city',
  kab: 'city',
  district: 'district',
  kecamatan: 'district',
  kec: 'district',
  village: 'village',
  nagari: 'village',
  kelurahan: 'village',
  desa: 'village',
  landmark: 'landmark',
  tempat: 'landmark'
};

export type ImportError = { line: number; message: string };
export type CsvLocationRow = {
  line: number;
  slug: string;
  name: string;
  level: Level;
  parentSlug: string | null;
  lat: number | null;
  lng: number | null;
  aliases: string[];
};

export { detectDelimiter, parseCsv };

const num = (s: string) => (s.trim() === '' ? null : Number(s.trim().replace(',', '.')));

export const MAX_IMPORT_ROWS = 5000;

/** Tahap 1: bentuk baris dan nilai per sel. Aturan antar-baris (induk, duplikat) ada di planImport. */
export function parseLocationCsv(input: string): { rows: CsvLocationRow[]; errors: ImportError[] } {
  const text = input.replace(/^﻿/, '');
  const table = parseCsv(text, detectDelimiter(text)).filter((r) => r.some((c) => c.trim() !== ''));
  const errors: ImportError[] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'File kosong' }] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const missing = ['slug', 'name', 'level'].filter((h) => col(h) < 0);
  if (missing.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Kolom wajib tidak ada: ${missing.join(', ')}` }]
    };
  if (table.length - 1 > MAX_IMPORT_ROWS)
    return {
      rows: [],
      errors: [{ line: 1, message: `Maksimal ${MAX_IMPORT_ROWS} baris per impor` }]
    };

  const rows: CsvLocationRow[] = [];
  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (name: string) => (col(name) < 0 ? '' : (cells[col(name)] ?? '').trim());
    const fail = (message: string) => errors.push({ line, message });

    const slug = get('slug');
    const name = get('name');
    const level = LEVEL_ALIASES[get('level').toLowerCase()];
    const lat = num(get('lat'));
    const lng = num(get('lng'));

    if (!slug || slugify(slug) !== slug)
      return fail(`slug "${slug}" tidak valid (huruf kecil, angka, tanda hubung)`);
    if (!name) return fail('name kosong');
    if (!level) return fail(`level "${get('level')}" tidak dikenal`);
    if ((lat === null) !== (lng === null)) return fail('lat dan lng harus diisi bersamaan');
    if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90))
      return fail(`lat "${get('lat')}" di luar -90..90`);
    if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180))
      return fail(`lng "${get('lng')}" di luar -180..180`);

    rows.push({
      line,
      slug,
      name,
      level,
      parentSlug: get('parent_slug') || null,
      lat,
      lng,
      aliases: [
        ...new Set(
          get('aliases')
            .split('|')
            .map((a) => a.trim())
            .filter(Boolean)
        )
      ]
    });
  });
  return { rows, errors };
}

/**
 * Tahap 2: aturan antar-baris. `existing` = lokasi yang sudah ada di database (slug -> tingkat).
 * Hasil `ordered` sudah urut dari tingkat tertinggi sehingga induk selalu diproses lebih dulu.
 */
export function planImport(
  rows: CsvLocationRow[],
  existing: Map<string, { level: Level }>
): { ordered: CsvLocationRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const inFile = new Map<string, CsvLocationRow>();
  const ok: CsvLocationRow[] = [];

  for (const r of rows) {
    if (inFile.has(r.slug)) {
      errors.push({
        line: r.line,
        message: `slug "${r.slug}" ganda (juga di baris ${inFile.get(r.slug)!.line})`
      });
      continue;
    }
    inFile.set(r.slug, r);
    ok.push(r);
  }

  const levelOf = (slug: string): Level | undefined =>
    inFile.get(slug)?.level ?? existing.get(slug)?.level;
  const valid: CsvLocationRow[] = [];
  for (const r of ok) {
    if (r.level === 'province' && r.parentSlug) {
      errors.push({ line: r.line, message: 'provinsi tidak boleh punya parent_slug' });
    } else if (r.parentSlug) {
      const parentLevel = levelOf(r.parentSlug);
      if (r.parentSlug === r.slug)
        errors.push({ line: r.line, message: 'parent_slug tidak boleh sama dengan slug sendiri' });
      else if (!parentLevel)
        errors.push({
          line: r.line,
          message: `parent_slug "${r.parentSlug}" tidak ditemukan di file maupun database`
        });
      else if (LEVEL_RANK[parentLevel] >= LEVEL_RANK[r.level]) {
        errors.push({
          line: r.line,
          message: `induk (${parentLevel}) harus lebih tinggi dari ${r.level}`
        });
      } else valid.push(r);
    } else valid.push(r);
  }

  const ordered = [...valid].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.line - b.line
  );
  return { ordered, errors: errors.sort((a, b) => a.line - b.line) };
}
