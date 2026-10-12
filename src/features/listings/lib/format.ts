// Fungsi bantu murni (tanpa database) agar mudah dites dan aman dipakai di server maupun klien.

export { slugify } from '@/lib/slug';

/** "0812-3456-789", "+62 812 3456 789", "812..." -> "62812..."; null bila kosong atau tidak valid. */
export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return /^62\d{8,13}$/.test(digits) ? digits : null;
}

/**
 * Koordinat dari tautan Google Maps panjang: .../@-0.9471,100.4172,17z, ...!3d-0.9471!4d100.4172,
 * atau ?q=-0.9471,100.4172. Tautan pendek (maps.app.goo.gl) tidak memuat koordinat: null.
 */
export function parseMapsCoords(url: string): { lat: number; lng: number } | null {
  const m =
    url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ??
    url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ??
    url.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

// Tipe isian khusus kategori. Nilai yang disimpan di `listings.attributes`:
// text -> string, number -> number, boolean -> true/false, select -> salah satu pilihan,
// multiselect -> daftar pilihan.
export const ATTRIBUTE_TYPES = ['text', 'number', 'boolean', 'select', 'multiselect'] as const;
export type AttributeType = (typeof ATTRIBUTE_TYPES)[number];
export type AttributeValue = string | number | boolean | string[];
export type AttributeDef = {
  key: string;
  label: string;
  type: AttributeType;
  /** Hanya untuk select dan multiselect. */
  options?: string[];
};

export const hasOptions = (type: AttributeType) => type === 'select' || type === 'multiselect';

const cleanOptions = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? [
        ...new Set(
          raw
            .filter((o): o is string => typeof o === 'string')
            .map((o) => o.trim())
            .filter(Boolean)
        )
      ]
    : [];

/** Definisi atribut di `categories.attribute_schema` bertipe bebas (JSON); ambil yang valid saja. */
export function parseAttributeSchema(raw: unknown): AttributeDef[] {
  if (!Array.isArray(raw)) return [];
  const out: AttributeDef[] = [];
  for (const a of raw) {
    if (!a || typeof a.key !== 'string' || typeof a.label !== 'string') continue;
    if (!(ATTRIBUTE_TYPES as readonly string[]).includes(a.type)) continue;
    const def: AttributeDef = { key: a.key, label: a.label, type: a.type };
    if (hasOptions(def.type)) {
      def.options = cleanOptions(a.options);
      if (def.options.length === 0) continue; // pilihan tanpa daftar tidak bisa diisi
    }
    out.push(def);
  }
  return out;
}

const YES = new Set(['ya', 'y', 'yes', 'true', '1', 'ada', 'iya']);
const NO = new Set(['tidak', 'no', 'false', '0', 'tidak ada', 'nggak', 'gak']);

/** Ubah masukan mentah (form atau CSV) menjadi nilai bertipe; undefined bila kosong atau tidak valid. */
export function coerceAttribute(def: AttributeDef, raw: unknown): AttributeValue | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  switch (def.type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const t = String(raw).trim().toLowerCase();
      return YES.has(t) ? true : NO.has(t) ? false : undefined;
    }
    case 'select': {
      const t = String(raw).trim().toLowerCase();
      return def.options?.find((o) => o.toLowerCase() === t);
    }
    case 'multiselect': {
      const items = Array.isArray(raw) ? raw.map(String) : String(raw).split(/[;,]/);
      const picked = items
        .map((i) => def.options?.find((o) => o.toLowerCase() === i.trim().toLowerCase()))
        .filter((o): o is string => !!o);
      const uniq = [...new Set(picked)];
      return uniq.length ? uniq : undefined;
    }
    default: {
      const t = String(raw).trim();
      return t || undefined;
    }
  }
}

/** Simpan hanya atribut yang didefinisikan kategori, dengan nilai yang valid menurut tipenya. */
export function cleanAttributes(
  raw: Record<string, AttributeValue | undefined>,
  defs: AttributeDef[]
): Record<string, AttributeValue> {
  const out: Record<string, AttributeValue> = {};
  for (const def of defs) {
    const v = coerceAttribute(def, raw[def.key]);
    if (v !== undefined) out[def.key] = v;
  }
  return out;
}
