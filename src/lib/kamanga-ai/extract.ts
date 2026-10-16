// Mengambil angka dan maksud sederhana dari kalimat warga. Murni (tanpa database), dikerjakan kode agar gratis dan bisa diuji.
import { norm } from '@/lib/directory/norm';
import { addDays, formatDay, fromJakarta, jakartaDate, jakartaTime } from '@/lib/engines/time';

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

// ───────────────────────── waktu (WIB) ─────────────────────────

export type Period = 'pagi' | 'siang' | 'sore' | 'malam';
/** Rentang jam dinding WIB tiap bagian hari. */
export const PERIODS: Record<Period, [string, string]> = {
  pagi: ['06:00', '11:00'],
  siang: ['11:00', '15:00'],
  sore: ['15:00', '18:00'],
  malam: ['18:00', '24:00']
};

/** Waktu yang diinginkan warga, sebagai jam dinding WIB. `to` boleh '24:00'; `days` = tambahan hari untuk `to`. */
export type When = { date: string; from: string; to: string; days?: number };

/** Potongan waktu yang disebut di satu pesan. */
export type WhenParts = {
  date?: string;
  period?: Period;
  hour?: { h: number; m: number };
  any?: boolean;
  now?: boolean;
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0,
  ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6
};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

/** "nanti malam", "besok jam 5", "sabtu sore", "tgl 18", "isuak pagi", "kapan saja". undefined bila tidak ada. */
export function parseWhen(text: string, now: Date): WhenParts | undefined {
  const raw = text.toLowerCase();
  const w = ` ${norm(text).replace('jum at', 'jumat')} `;
  const has = (re: RegExp) => re.test(w);
  const today = jakartaDate(now);
  const p: WhenParts = {};

  if (has(/ (kapan saja|kapan aja|kapan pun|terserah|bebas) /)) p.any = true;
  if (has(/ (sekarang|kini) /)) p.now = true;
  if (has(/ (besok|besoknya|isuak|esok) /)) p.date = addDays(today, 1);
  else if (has(/ lusa /)) p.date = addDays(today, 2);
  else if (has(/ (hari ini|nanti|ntar|malam ini|sore ini|siang ini|pagi ini|malam ko|sore ko) /))
    p.date = today;
  else {
    const wd = w.match(/ (minggu|ahad|senin|selasa|rabu|kamis|jumat|sabtu) (?!depan|ini|lalu)/);
    const dm =
      raw.match(/\b(?:tanggal|tgl)\s*(\d{1,2})\b/) ??
      raw.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|mei|jun|jul|agu|agt|ags|sep|okt|nov|des)[a-z]*\b/);
    if (wd && !/ seminggu /.test(w)) {
      const delta = (WEEKDAYS[wd[1]] - new Date(`${today}T00:00:00Z`).getUTCDay() + 7) % 7;
      p.date = addDays(today, delta);
    } else if (dm) {
      const day = Number(dm[1]);
      const [y, mo] = today.split('-').map(Number);
      const month = dm[2] ? MONTHS.indexOf(dm[2].replace(/^ag[ts]$/, 'agu')) + 1 : mo;
      if (day >= 1 && day <= 31 && month >= 1) {
        let d = `${y}-${pad(month)}-${pad(day)}`;
        if (d < today) d = dm[2] ? `${y + 1}-${pad(month)}-${pad(day)}` : nextMonth(y, mo, day);
        p.date = d;
      }
    }
  }
  if (has(/ pagi /)) p.period = 'pagi';
  else if (has(/ siang /)) p.period = 'siang';
  else if (has(/ (sore|petang|patang) /)) p.period = 'sore';
  else if (has(/ (malam|malem) /)) p.period = 'malam';
  const hm = raw.match(/\b(?:jam|pukul|pkl)\s*(\d{1,2})(?:[.:](\d{2}))?\b/);
  if (hm && Number(hm[1]) <= 24 && Number(hm[2] ?? 0) < 60)
    p.hour = { h: Number(hm[1]) % 24, m: Number(hm[2] ?? 0) };
  return Object.keys(p).length ? p : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');
const nextMonth = (y: number, mo: number, day: number) => {
  const [ny, nm] = mo === 12 ? [y + 1, 1] : [y, mo + 1];
  return `${ny}-${pad(nm)}-${pad(day)}`;
};
const clock = (min: number) =>
  min >= 1440
    ? '24:00'
    : `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Bagian hari dari jam mulai sebuah rentang. */
const periodOf = (from: string): Period => {
  const h = Number(from.slice(0, 2));
  return h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
};

/**
 * Gabungkan waktu baru dengan waktu sebelumnya: hanya yang disebut yang berubah ("bisa jam 5?" mempertahankan
 * tanggal). Jam 1-6 tanpa "pagi" dibaca sore/malam (orang jarang memesan lapangan jam 5 subuh).
 */
export function mergeWhen(prev: When | null | undefined, p: WhenParts, now: Date): When {
  const today = jakartaDate(now);
  let date = p.date ?? prev?.date ?? today;
  let from: string;
  let to: string;
  let days = 0;
  if (p.any) {
    [from, to, days] = ['00:00', '24:00', p.date ? 0 : 1];
  } else if (p.hour) {
    let h = p.hour.h;
    const period = p.period ?? (prev ? periodOf(prev.from) : undefined);
    if (h > 0 && h < 12 && period !== 'pagi' && (period !== 'siang' || h < 6))
      if (h <= 6 || period === 'sore' || period === 'malam') h += 12;
    const start = h * 60 + p.hour.m;
    [from, to] = [clock(start), clock(start + 60)];
  } else if (p.period) {
    [from, to] = PERIODS[p.period];
  } else if (p.now) {
    const start = Math.floor(minutes(jakartaTime(now)) / 60) * 60;
    [from, to] = [clock(start), clock(start + 180)];
  } else if (prev && !prev.days) {
    [from, to] = [prev.from, prev.to];
  } else {
    [from, to] = ['06:00', '24:00'];
  }
  // Rentang hari ini yang sudah lewat seluruhnya, tanpa tanggal yang disebut: maksudnya besok.
  if (!p.date && date === today && to !== '24:00' && minutes(to) <= minutes(jakartaTime(now)))
    date = addDays(today, 1);
  return days ? { date, from, to, days } : { date, from, to };
}

/** When → rentang Date untuk mesin. */
export function whenRange(w: When): { from: Date; to: Date } {
  const days = w.days ?? 0;
  return {
    from: fromJakarta(w.date, w.from),
    to:
      w.to === '24:00'
        ? fromJakarta(addDays(w.date, days + 1), '00:00')
        : fromJakarta(addDays(w.date, days), w.to)
  };
}

const dot = (s: string) => s.replace(':', '.');

/** "malam ini", "besok malam", "Sabtu, 18 Okt jam 17.00", "hari ini dan besoknya". */
export function whenLabel(w: When, now: Date): string {
  const today = jakartaDate(now);
  const day =
    w.date === today
      ? 'hari ini'
      : w.date === addDays(today, 1)
        ? 'besok'
        : w.date === addDays(today, 2)
          ? 'lusa'
          : formatDay(fromJakarta(w.date, '12:00'));
  if (w.days) return `${day} dan besoknya`;
  const period = (Object.keys(PERIODS) as Period[]).find(
    (k) => PERIODS[k][0] === w.from && PERIODS[k][1] === w.to
  );
  if (period) return w.date === today ? `${period} ini` : `${day} ${period}`;
  if (w.to === '24:00' && (w.from === '00:00' || w.from === '06:00')) return day;
  return minutes(w.to) - minutes(w.from) === 60 || (w.to === '24:00' && w.from === '23:00')
    ? `${day} jam ${dot(w.from)}`
    : `${day} ${dot(w.from)}–${dot(w.to)}`;
}

// ───────────────────────── jumlah orang ─────────────────────────

const PEOPLE_WORDS: Record<string, number> = {
  sendiri: 1,
  sendirian: 1,
  surang: 1,
  berdua: 2,
  baduo: 2,
  bertiga: 3,
  batigo: 3,
  berempat: 4,
  barampek: 4,
  baampek: 4,
  berlima: 5,
  balimo: 5,
  berenam: 6,
  baanam: 6,
  baranam: 6,
  bertujuh: 7,
  batujuah: 7,
  berdelapan: 8,
  basalapan: 8,
  bersepuluh: 10,
  basapuluah: 10
};

/** "4 orang", "barampek", "berdua", "ber4", "3 penumpang". "per orang" bukan jumlah. Batas 1-60. */
export function extractPeople(text: string): number | undefined {
  for (const x of norm(text).split(' ')) if (PEOPLE_WORDS[x]) return PEOPLE_WORDS[x];
  const t = text.toLowerCase();
  const byCount = [
    ...t.matchAll(/(\d{1,3})\s*(?:orang|org|urang|pax|penumpang|kursi|pemain)\b/g)
  ].find((m) => !/(?:per|\/)\s*$/.test(t.slice(0, m.index).slice(-5)));
  const n = Number(byCount?.[1] ?? t.match(/\b(?:ber|ba)(\d{1,2})\b/)?.[1]);
  return Number.isInteger(n) && n >= 1 && n <= 60 ? n : undefined;
}

// ───────────────────────── maksud singkat ─────────────────────────

export const isYes = (text: string) =>
  words(text).length <= 5 &&
  /^(ya|iya|iyo|yo|boleh|bolehlah|tanyakan|tolong tanyakan|oke|ok|okey|mau|yuk|lanjut|silakan|sip)\b/.test(
    norm(text)
  );
export const isNo = (text: string) =>
  words(text).length <= 5 &&
  /^(tidak|nggak|ngga|ndak|indak|gak|ga|enggak|batal|jangan|ndak usah|tidak usah)\b/.test(
    norm(text)
  );

/** Upaya mengubah aturan asisten. Selalu dijawab template, tidak pernah diteruskan ke model AI. */
export const isJailbreak = (text: string) =>
  /\b(abaikan|lupakan|ignore|hapus) (semua |seluruh |all |previous )?(aturan|instruksi|perintah|prompt|rules|instructions)|system prompt|prompt sistem|tampilkan (instruksi|prompt)|jailbreak|kamu sekarang adalah|pura pura jadi|roleplay/.test(
    norm(text)
  );

/** Permintaan di luar layanan Kamanga (menulis karya, pengetahuan umum, politik, judi). Dicek hanya bila tidak ada
 *  kategori/pintu yang dikenali di pesan itu. Dijawab template tanpa model AI (PRD 8.2). */
export const isOutOfScope = (text: string) =>
  /\b(puisi|pantun|lirik|cerpen|dongeng|lelucon|lawakan|lawak|humor|jokes?|presiden|politik|pemilu|capres|partai|berita|ramalan|zodiak|horoskop|togel|judi|matematika|skripsi|makalah|esai|essay|pr sekolah|terjemahkan|translate|coding|kode program|python|javascript|resep)\b|^(buatkan|bikinkan|tuliskan|ceritakan|karang)\b/.test(
    norm(text)
  );

/** Sembunyikan nomor telepon dan email sebelum teks dikirim ke model AI atau ke penyedia. */
export const redact = (text: string) =>
  text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(?:\+|\b)\d[\d\s.-]{7,}\d\b/g, '[nomor]');
