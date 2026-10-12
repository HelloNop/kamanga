// Mengambil angka dan maksud sederhana dari kalimat warga. Murni (tanpa database), dikerjakan kode agar gratis dan bisa diuji.
import { norm } from '@/lib/directory/understand';

export type Budget = {
  max: number;
  unit?: 'per_person' | 'per_hour' | 'per_day' | 'per_event' | 'per_visit';
};

const MULT: Record<string, number> = {
  ribu: 1_000,
  rb: 1_000,
  k: 1_000,
  juta: 1_000_000,
  jt: 1_000_000
};

function toNumber(raw: string): number {
  const t = raw.trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, '')); // 40.000
  if (/^\d+,\d+$/.test(t)) return Number(t.replace(',', '.')); // 1,5
  return Number(t.replace(/[.,]/g, ''));
}

function unitOf(text: string): Budget['unit'] {
  const t = text.toLowerCase();
  if (/(?:per|\/)\s*(?:orang|porsi|pax|kepala)\b|\bperorang\b/.test(t)) return 'per_person';
  if (/(?:per|\/)\s*jam\b/.test(t)) return 'per_hour';
  if (/(?:per|\/)\s*hari\b|\bsehari\b/.test(t)) return 'per_day';
  if (/(?:per|\/)\s*(?:acara|event)\b/.test(t)) return 'per_event';
  if (/(?:per|\/)\s*(?:kunjungan|datang)\b/.test(t)) return 'per_visit';
  return undefined;
}

/** "budget 40rb per orang", "di bawah Rp 2 juta", "maksimal 500.000", "50k". Angka tanpa kata penunjuk anggaran/satuan diabaikan. */
export function extractBudget(text: string): Budget | undefined {
  const t = text.toLowerCase();
  const patterns = [
    /\b(?:budget|anggaran|maks(?:imal|imum)?|paling mahal|kurang dari|di ?bawah|sampai|hingga)\s*(?:sekitar\s*)?(?:rp\.?\s*)?(\d[\d.,]*)\s*(ribu|rb|k|juta|jt)?(?![a-z])/,
    /\brp\.?\s*(\d[\d.,]*)\s*(ribu|rb|k|juta|jt)?(?![a-z])/,
    /\b(\d[\d.,]*)\s*(ribu|rb|juta|jt|k)(?![a-z])/
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const n = toNumber(m[1]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const amount = Math.round(n * (m[2] ? MULT[m[2]] : 1));
    if (amount < 1_000 || amount > 1_000_000_000) continue; // "budget 5" bukan anggaran yang bisa dipakai
    return { max: amount, unit: unitOf(t) };
  }
  return undefined;
}

/** "untuk 300 tamu", "kapasitas 500", "400 orang". "per orang" bukan kapasitas. */
export function extractCapacity(text: string): number | undefined {
  const t = text.toLowerCase();
  const byLabel = t.match(/kapasitas\s*(?:min(?:imal|imum)?\s*)?(\d[\d.]*)/);
  const byCount = [...t.matchAll(/(\d[\d.]*)\s*(?:orang|tamu|undangan|kursi|pax|jiwa)\b/g)].find(
    (m) => !/(?:per|\/)\s*$/.test(t.slice(0, m.index).slice(-5))
  );
  const raw = byLabel?.[1] ?? byCount?.[1];
  if (!raw) return undefined;
  const n = toNumber(raw);
  return Number.isFinite(n) && n >= 10 && n <= 100_000 ? n : undefined;
}

const words = (text: string) => norm(text).split(' ').filter(Boolean);
const GREET = new Set([
  'halo',
  'hai',
  'hi',
  'hello',
  'hallo',
  'assalamualaikum',
  'assalamu',
  'salam',
  'selamat',
  'pagi',
  'siang',
  'sore',
  'malam',
  'permisi',
  'tes',
  'test',
  'p',
  'ping',
  'woi',
  'oi'
]);
const FILLER = new Set([
  'kamanga',
  'ai',
  'uda',
  'uni',
  'kak',
  'min',
  'admin',
  'alaikum',
  'wr',
  'wb',
  'bro',
  'sis',
  'apa',
  'kabar',
  'bos'
]);

export function isGreeting(text: string): boolean {
  const w = words(text);
  return (
    w.length > 0 &&
    w.length <= 5 &&
    GREET.has(w[0]) &&
    w.every((x) => GREET.has(x) || FILLER.has(x))
  );
}
export const isThanks = (text: string) =>
  words(text).length <= 6 &&
  /\b(terima kasih|makasih|trims|thanks|thank you|tq|mantap|oke makasih)\b/.test(norm(text));
export const isMenuRequest = (text: string) =>
  words(text).length <= 6 &&
  /\b(menu|bisa apa|bantu apa|fitur|help|bantuan|cara pakai|apa saja)\b/.test(norm(text));
