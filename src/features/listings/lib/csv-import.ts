// Impor listing dari CSV: aturan murni (tanpa database). Pencarian kategori/lokasi dilakukan lewat `Lookups`
// yang diisi repository. Hasilnya daftar baris terencana + daftar kesalahan per baris.
import { detectDelimiter, parseCsv } from '@/lib/csv';
import { slugify } from '@/lib/slug';
import {
  PRICE_UNITS,
  SERVICE_MODES,
  STATUSES,
  VERIFICATIONS,
  type ListingStatus,
  type PriceUnit,
  type ServiceMode,
  type VerificationLevel
} from '../constants/listing-options';
import { emptyListingForm, listingFormSchema, type ListingFormValues } from '../schemas/listing';
import { coerceAttribute, type AttributeDef } from './format';

export type ImportError = { line: number; message: string };
export type ImportMode = 'create' | 'upsert';
export const MAX_LISTING_ROWS = 2000;

export type Lookups = {
  categories: { id: number; slug: string; name: string; attributes: AttributeDef[] }[];
  locations: { id: number; slug: string; name: string; level: string; parentName: string | null }[];
  existing: Map<string, number>; // slug listing yang sudah ada -> id
};

export type PlannedRow = {
  line: number;
  slug: string;
  name: string;
  action: 'create' | 'update' | 'skip';
  existingId?: number;
  /** Hanya kolom yang diisi di CSV. Untuk `create` sudah digabung dengan nilai bawaan formulir. */
  values: Partial<ListingFormValues>;
};

const HEADERS = [
  'name',
  'slug',
  'category',
  'extra_categories',
  'summary',
  'description',
  'address',
  'location',
  'lat',
  'lng',
  'service_modes',
  'areas',
  'whatsapp',
  'phone',
  'instagram',
  'website',
  'maps_url',
  'price_min',
  'price_max',
  'price_unit',
  'price_note',
  'keywords',
  'attributes',
  'status',
  'verification',
  'source_url'
] as const;

const key = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
const dictionary = <T extends string>(canon: readonly T[], extra: Record<string, T>) =>
  new Map<string, T>([
    ...canon.map((c) => [key(c), c] as [string, T]),
    ...Object.entries(extra).map(([k, v]) => [key(k), v] as [string, T])
  ]);

const MODE_MAP = dictionary<ServiceMode>(SERVICE_MODES, {
  'di tempat': 'on_site',
  tempat: 'on_site',
  panggilan: 'on_call',
  'datang ke pelanggan': 'on_call',
  daring: 'online'
});
const UNIT_MAP = dictionary<PriceUnit>(PRICE_UNITS, {
  'per acara': 'per_event',
  'per jam': 'per_hour',
  'per hari': 'per_day',
  'per kunjungan': 'per_visit',
  'per orang': 'per_person',
  'per proyek': 'per_project',
  lainnya: 'other'
});
const STATUS_MAP = dictionary<ListingStatus>(STATUSES, {
  draf: 'draft',
  terbit: 'published',
  'menunggu review': 'pending_review',
  diarsipkan: 'archived'
});
const VERIFY_MAP = dictionary<VerificationLevel>(VERIFICATIONS, {
  belum: 'unverified',
  'belum terverifikasi': 'unverified',
  'kontak dicek': 'contact_checked',
  'dicek langsung': 'visited'
});

const list = (cell: string) => [
  ...new Set(
    cell
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean)
  )
];
const decimal = (s: string) => Number(s.trim().replace(',', '.'));
/** "35.000", "Rp 35.000", "35000" -> 35000; selain itu NaN. */
export const parseRupiah = (s: string) => {
  const t = s
    .trim()
    .replace(/^rp\.?\s*/i, '')
    .replace(/\s/g, '');
  return /^\d{1,3}(\.\d{3})+$|^\d+$/.test(t) ? Number(t.replace(/\./g, '')) : NaN;
};

export function parseListingCsv(input: string): {
  rows: { line: number; cells: Record<string, string> }[];
  errors: ImportError[];
} {
  const text = input.replace(/^﻿/, '');
  const table = parseCsv(text, detectDelimiter(text)).filter((r) => r.some((c) => c.trim() !== ''));
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: 'File kosong' }] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const unknown = header.filter((h) => h && !(HEADERS as readonly string[]).includes(h));
  if (unknown.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Kolom tidak dikenal: ${unknown.join(', ')}` }]
    };
  const missing = ['name', 'category'].filter((h) => !header.includes(h));
  if (missing.length)
    return {
      rows: [],
      errors: [{ line: 1, message: `Kolom wajib tidak ada: ${missing.join(', ')}` }]
    };
  if (table.length - 1 > MAX_LISTING_ROWS)
    return {
      rows: [],
      errors: [{ line: 1, message: `Maksimal ${MAX_LISTING_ROWS} baris per impor` }]
    };

  return {
    rows: table.slice(1).map((cells, i) => ({
      line: i + 2,
      cells: Object.fromEntries(
        header.map((h, c) => [h, (cells[c] ?? '').trim()]).filter(([h]) => h)
      )
    })),
    errors: []
  };
}

export function planListingImport(
  rows: { line: number; cells: Record<string, string> }[],
  lookups: Lookups,
  mode: ImportMode
): { planned: PlannedRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const planned: PlannedRow[] = [];
  const seen = new Map<string, number>();

  const catBySlug = new Map(lookups.categories.map((c) => [c.slug, c]));
  const catByName = new Map(lookups.categories.map((c) => [key(c.name), c]));
  const locBySlug = new Map(lookups.locations.map((l) => [l.slug, l]));
  const locByName = new Map<string, typeof lookups.locations>();
  for (const l of lookups.locations)
    locByName.set(key(l.name), [...(locByName.get(key(l.name)) ?? []), l]);

  for (const { line, cells } of rows) {
    const rowErrors: string[] = [];
    const err = (m: string) => rowErrors.push(m);
    const cell = (h: string) => cells[h] ?? '';

    const findCategory = (s: string) => {
      const c = catBySlug.get(s.trim().toLowerCase()) ?? catByName.get(key(s));
      if (!c) err(`kategori "${s}" tidak ditemukan`);
      return c;
    };
    const findLocation = (s: string, what: string) => {
      const l = locBySlug.get(s.trim().toLowerCase());
      if (l) return l;
      const byName = locByName.get(key(s)) ?? [];
      if (byName.length === 1) return byName[0];
      err(
        byName.length > 1
          ? `${what} "${s}" ambigu (${byName.length} lokasi bernama sama); tulis slug-nya`
          : `${what} "${s}" tidak ditemukan`
      );
    };
    const mapped = <T extends string>(map: Map<string, T>, s: string, what: string) => {
      const v = map.get(key(s));
      if (!v) err(`${what} "${s}" tidak dikenal`);
      return v;
    };

    const values: Partial<ListingFormValues> = {};
    const text = (h: string, to: keyof ListingFormValues) =>
      cell(h) && Object.assign(values, { [to]: cell(h) });
    text('name', 'name');
    text('summary', 'summary');
    text('description', 'description');
    text('address', 'address');
    text('whatsapp', 'whatsapp');
    text('phone', 'phone');
    text('instagram', 'instagram');
    text('website', 'website');
    text('maps_url', 'mapsUrl');
    text('price_note', 'priceNote');
    text('source_url', 'sourceUrl');

    let category: ReturnType<typeof findCategory>;
    if (cell('category')) {
      category = findCategory(cell('category'));
      if (category) values.primaryCategoryId = String(category.id);
    }
    if (cell('extra_categories')) {
      values.extraCategoryIds = list(cell('extra_categories')).flatMap((s) => {
        const c = findCategory(s);
        return c ? [String(c.id)] : [];
      });
    }
    let location: ReturnType<typeof findLocation>;
    if (cell('location')) {
      location = findLocation(cell('location'), 'lokasi');
      if (location) values.locationId = String(location.id);
    }
    if (cell('areas')) {
      values.areaIds = list(cell('areas')).flatMap((s) => {
        const l = findLocation(s, 'area layanan');
        return l ? [String(l.id)] : [];
      });
    }
    if (cell('service_modes')) {
      values.serviceModes = list(cell('service_modes')).flatMap((s) => {
        const m = mapped(MODE_MAP, s, 'cara layanan');
        return m ? [m] : [];
      });
    }
    for (const [h, to] of [
      ['lat', 'lat'],
      ['lng', 'lng']
    ] as const) {
      if (!cell(h)) continue;
      const n = decimal(cell(h));
      if (Number.isFinite(n)) values[to] = n;
      else err(`${h} "${cell(h)}" bukan angka`);
    }
    for (const [h, to] of [
      ['price_min', 'priceMin'],
      ['price_max', 'priceMax']
    ] as const) {
      if (!cell(h)) continue;
      const n = parseRupiah(cell(h));
      if (Number.isFinite(n)) values[to] = n;
      else err(`${h} "${cell(h)}" bukan bilangan rupiah yang valid`);
    }
    if (cell('price_unit')) values.priceUnit = mapped(UNIT_MAP, cell('price_unit'), 'satuan harga');
    if (cell('status')) {
      const s = mapped(STATUS_MAP, cell('status'), 'status');
      if (s) values.status = s;
    }
    if (cell('verification')) {
      const v = mapped(VERIFY_MAP, cell('verification'), 'verifikasi');
      if (v) values.verificationLevel = v;
    }
    if (cell('keywords')) values.keywords = list(cell('keywords'));
    if (cell('attributes')) {
      const attrs: Record<string, string> = {};
      for (const pair of list(cell('attributes'))) {
        const eq = pair.indexOf('=');
        if (eq < 1) err(`atribut "${pair}" harus berbentuk kunci=nilai`);
        else attrs[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
      }
      if (category) {
        const byKey = new Map(category.attributes.map((a) => [a.key, a]));
        const bad = Object.keys(attrs).filter((k) => !byKey.has(k));
        if (bad.length) err(`atribut ${bad.join(', ')} tidak ada di kategori ${category.name}`);
        for (const [k, raw] of Object.entries(attrs)) {
          const def = byKey.get(k);
          if (def && coerceAttribute(def, raw) === undefined) {
            const hint =
              def.type === 'number'
                ? 'harus angka'
                : def.type === 'boolean'
                  ? 'harus ya atau tidak'
                  : `harus salah satu dari: ${(def.options ?? []).join(', ')}`;
            err(`atribut ${k}: nilai "${raw}" tidak valid (${hint})`);
          }
        }
      }
      values.attributes = attrs;
    }
    if (values.status === 'rejected') err('status rejected tidak bisa lewat impor');

    // slug: dari kolom slug, atau dari nama (+ slug lokasi) agar impor ulang mengenali listing yang sama
    const name = cell('name');
    const slug = cell('slug') || slugify(`${name} ${location?.slug ?? ''}`);
    if (!slug) err('isi slug atau name');
    else if (cell('slug') && slugify(cell('slug')) !== cell('slug'))
      err(`slug "${cell('slug')}" tidak valid (huruf kecil, angka, tanda hubung)`);
    else if (seen.has(slug)) err(`slug "${slug}" ganda (juga di baris ${seen.get(slug)})`);
    else seen.set(slug, line);

    const existingId = lookups.existing.get(slug);
    const action: PlannedRow['action'] =
      existingId === undefined ? 'create' : mode === 'upsert' ? 'update' : 'skip';

    if (action === 'create') {
      if (!name) err('name kosong');
      if (!cell('category')) err('category kosong');
      if (!rowErrors.length) {
        const full: ListingFormValues = { ...emptyListingForm, ...values, slug, source: 'import' };
        const parsed = listingFormSchema.safeParse(full);
        if (!parsed.success) err(parsed.error.issues[0]?.message ?? 'data tidak valid');
        else planned.push({ line, slug, name, action, values: full });
      }
    } else if (!rowErrors.length) {
      planned.push({ line, slug, name, action, existingId, values });
    }
    for (const m of rowErrors) errors.push({ line, message: m });
  }
  return { planned, errors: errors.sort((a, b) => a.line - b.line) };
}
