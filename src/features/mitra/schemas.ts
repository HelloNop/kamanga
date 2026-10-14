// Skema masukan dashboard mitra. Dipakai formulir (klien) DAN divalidasi ulang di server action.
// Murni (tanpa database).
import * as z from 'zod';
import { WEEKDAYS } from './lib/format';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Isi jam, mis. 08:00');
const optHhmm = hhmm.or(z.literal(''));
const rupiah = z.number().int('Tanpa desimal').min(0, 'Tidak boleh minus').max(100_000_000);
const id = z.number().int().positive();

// ───────────────────────────── Jam buka ─────────────────────────────

/**
 * Satu pola jam buka untuk beberapa hari sekaligus, mis. "Senin–Jumat 08:00–22:00, slot 60 menit".
 * Disimpan sebagai satu baris schedule_rules per hari. Travel (seat): start = jam berangkat,
 * slotMinutes = lama perjalanan, price = harga per kursi; isian lain diabaikan.
 */
export const patternSchema = z.object({
  days: z.array(z.enum(['0', '1', '2', '3', '4', '5', '6'])).min(1, 'Pilih minimal satu hari'),
  start: hhmm,
  end: optHhmm,
  slotMinutes: z.number('Isi durasi').int().min(5, 'Minimal 5 menit').max(1440, 'Maksimal 24 jam'),
  gapMinutes: z.number().int().min(0).max(720, 'Maksimal 12 jam'),
  minMinutes: z.number().int().min(5).max(1440).optional(),
  price: rupiah.optional(),
  peakPrice: rupiah.optional(),
  peakStart: optHhmm,
  peakEnd: optHhmm
});
export type Pattern = z.infer<typeof patternSchema>;
export type RuleKind = 'slot' | 'seat';

export const emptyPattern = (kind: RuleKind): Pattern => ({
  days: ['1', '2', '3', '4', '5'],
  start: kind === 'seat' ? '07:00' : '08:00',
  end: kind === 'seat' ? '' : '22:00',
  slotMinutes: kind === 'seat' ? 180 : 60,
  gapMinutes: 0,
  minMinutes: undefined,
  price: undefined,
  peakPrice: undefined,
  peakStart: '',
  peakEnd: ''
});

/** Baris schedule_rules (tanpa unit). Jam "HH:MM". */
export type RuleRow = {
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  gapMinutes: number;
  minMinutes: number | null;
  price: number | null;
  peakPrice: number | null;
  peakStart: string | null;
  peakEnd: string | null;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
/** Panjang interval jam buka; tutup <= buka berarti lewat tengah malam, sama = 24 jam. */
const spanMinutes = (start: string, end: string) =>
  (toMin(end) - toMin(start) + 1440) % 1440 || 1440;

/** Pola → baris per hari. */
export function expandPatterns(kind: RuleKind, patterns: Pattern[]): RuleRow[] {
  return patterns.flatMap((p) =>
    [...new Set(p.days)].map((d) =>
      kind === 'seat'
        ? {
            weekday: Number(d),
            startTime: p.start,
            endTime: fromMin(toMin(p.start) + p.slotMinutes), // jam tiba, hanya informasi
            slotMinutes: p.slotMinutes,
            gapMinutes: 0,
            minMinutes: null,
            price: p.price ?? null,
            peakPrice: null,
            peakStart: null,
            peakEnd: null
          }
        : {
            weekday: Number(d),
            startTime: p.start,
            endTime: p.end,
            slotMinutes: p.slotMinutes,
            gapMinutes: p.gapMinutes,
            minMinutes: p.minMinutes ?? null,
            price: p.price ?? null,
            peakPrice: p.peakPrice ?? null,
            peakStart: p.peakPrice != null && p.peakStart ? p.peakStart : null,
            peakEnd: p.peakPrice != null && p.peakEnd ? p.peakEnd : null
          }
    )
  );
}

/** Baris dari database → pola (hari dengan isian sama digabung). Kebalikan expandPatterns. */
export function groupRules(rows: RuleRow[]): Pattern[] {
  const out = new Map<string, Pattern>();
  const sorted = rows.toSorted(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.weekday - b.weekday
  );
  for (const r of sorted) {
    const p: Pattern = {
      days: [],
      start: r.startTime.slice(0, 5),
      end: r.endTime.slice(0, 5),
      slotMinutes: r.slotMinutes,
      gapMinutes: r.gapMinutes,
      minMinutes: r.minMinutes ?? undefined,
      price: r.price ?? undefined,
      peakPrice: r.peakPrice ?? undefined,
      peakStart: r.peakStart?.slice(0, 5) ?? '',
      peakEnd: r.peakEnd?.slice(0, 5) ?? ''
    };
    const key = JSON.stringify(p);
    const hit = out.get(key) ?? p;
    hit.days.push(String(r.weekday) as Pattern['days'][number]);
    out.set(key, hit);
  }
  return [...out.values()];
}

export type PatternIssue = { index: number; field: keyof Pattern; message: string };

/** Pemeriksaan antar-isian dan antar-pola: interval muat slot, jam ramai lengkap, tidak ada jam buka bertumpuk. */
export function checkPatterns(kind: RuleKind, patterns: Pattern[]): PatternIssue[] {
  const issues: PatternIssue[] = [];
  const add = (index: number, field: keyof Pattern, message: string) =>
    issues.push({ index, field, message });
  const WEEK = 7 * 1440;
  // [mulai, selesai) dalam menit sejak Minggu 00:00, untuk cek tumpang tindih.
  const taken: { s: number; e: number; day: number; index: number }[] = [];

  patterns.forEach((p, i) => {
    if (kind === 'seat') {
      for (const d of new Set(p.days)) {
        const s = Number(d) * 1440 + toMin(p.start);
        const dup = taken.find((t) => t.s === s);
        if (dup)
          add(i, 'start', `Keberangkatan ${WEEKDAYS[Number(d)]} ${p.start} sudah ada di pola lain`);
        else taken.push({ s, e: s + 1, day: Number(d), index: i });
      }
      return;
    }
    if (!p.end) return add(i, 'end', 'Isi jam tutup');
    const len = spanMinutes(p.start, p.end);
    if (p.slotMinutes > len)
      add(i, 'slotMinutes', `Durasi slot lebih panjang dari jam buka (${len} menit)`);
    if (p.minMinutes !== undefined && p.minMinutes < p.slotMinutes)
      add(i, 'minMinutes', 'Durasi minimal tidak boleh kurang dari satu slot');
    if (p.minMinutes !== undefined && p.minMinutes > len)
      add(i, 'minMinutes', 'Durasi minimal lebih panjang dari jam buka');
    const anyPeak = p.peakPrice !== undefined || !!p.peakStart || !!p.peakEnd;
    if (anyPeak) {
      if (p.peakPrice === undefined) add(i, 'peakPrice', 'Isi harga jam ramai');
      if (!p.peakStart) add(i, 'peakStart', 'Isi jam mulai ramai');
      if (!p.peakEnd) add(i, 'peakEnd', 'Isi jam selesai ramai');
      if (p.peakStart && p.peakStart === p.peakEnd)
        add(i, 'peakEnd', 'Jam selesai ramai harus berbeda dari jam mulainya');
    }
    for (const d of new Set(p.days)) {
      const s = Number(d) * 1440 + toMin(p.start);
      const e = s + len;
      // Bandingkan juga dengan minggu sebelum/sesudahnya: Sabtu malam yang lewat tengah malam menyentuh Minggu.
      const clash = taken.find((t) => [-WEEK, 0, WEEK].some((k) => s < t.e + k && t.s + k < e));
      if (clash)
        add(
          i,
          'start',
          `Jam buka ${WEEKDAYS[Number(d)]} bertumpuk dengan pola ${clash.index === i ? 'ini sendiri' : `ke-${clash.index + 1}`}`
        );
      else taken.push({ s, e, day: Number(d), index: i });
    }
  });
  return issues;
}

/** Skema formulir jam buka satu unit: isian per pola + pemeriksaan antar-pola. */
export const rulesFormSchema = (kind: RuleKind) =>
  z.object({ patterns: z.array(patternSchema).max(50) }).superRefine((v, ctx) => {
    for (const x of checkPatterns(kind, v.patterns))
      ctx.addIssue({ code: 'custom', message: x.message, path: ['patterns', x.index, x.field] });
  });

// ───────────────────────────── Unit, pengecualian, blokir ─────────────────────────────

export const unitSchema = z.object({
  name: z.string().trim().min(1, 'Isi nama unit').max(60, 'Maksimal 60 karakter'),
  // Jadwal slot selalu 1; travel = jumlah kursi.
  capacity: z.number('Isi jumlah kursi').int().min(1, 'Minimal 1').max(60, 'Maksimal 60'),
  originLocationId: z.string(), // '' = kosong
  destinationLocationId: z.string()
});
export type UnitInput = z.infer<typeof unitSchema>;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), 'Tanggal tidak valid');

export const exceptionSchema = z
  .object({
    date: isoDate,
    unitId: z.string(), // '' = semua unit
    closed: z.boolean(),
    start: optHhmm,
    end: optHhmm,
    note: z.string().trim().max(200, 'Maksimal 200 karakter')
  })
  .superRefine((v, ctx) => {
    if (v.closed) return;
    if (!v.start) ctx.addIssue({ code: 'custom', message: 'Isi jam buka', path: ['start'] });
    if (!v.end) ctx.addIssue({ code: 'custom', message: 'Isi jam tutup', path: ['end'] });
  });
export type ExceptionInput = z.infer<typeof exceptionSchema>;

export const BLOCK_REASONS = ['walk_in', 'whatsapp', 'other'] as const;
export const BLOCK_REASON_LABEL: Record<(typeof BLOCK_REASONS)[number], string> = {
  walk_in: 'Datang langsung',
  whatsapp: 'Pesanan lewat WA',
  other: 'Lainnya'
};

export const blockSchema = z.object({
  unitId: id,
  startsAt: z.date(),
  endsAt: z.date(),
  reason: z.enum(BLOCK_REASONS),
  note: z.string().trim().max(200)
});
export type BlockInput = z.infer<typeof blockSchema>;

// ───────────────────────────── Tanya jawab, pesanan ─────────────────────────────

export const qaSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Pertanyaan minimal 3 karakter')
    .max(500, 'Maksimal 500 karakter'),
  answer: z.string().trim().min(1, 'Isi jawabannya').max(2000, 'Maksimal 2000 karakter')
});
export type QaInput = z.infer<typeof qaSchema>;

export const answerSchema = qaSchema.pick({ answer: true });

export const BOOKING_ACTIONS = ['accept', 'reject', 'start', 'complete', 'cancel'] as const;
export type BookingAction = (typeof BOOKING_ACTIONS)[number];

export const bookingActionSchema = z
  .object({
    action: z.enum(BOOKING_ACTIONS),
    reason: z.string().trim().max(300, 'Maksimal 300 karakter')
  })
  .refine((v) => v.action !== 'cancel' || v.reason.length >= 3, {
    message: 'Tulis alasan pembatalan',
    path: ['reason']
  });
