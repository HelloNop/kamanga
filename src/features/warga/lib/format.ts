// Fungsi bantu murni untuk halaman warga (aman di server dan klien, tanpa database).
import type {
  BookingStatus,
  BookingView,
  RulesSnapshot,
  ServicePeriod
} from '@/lib/engines/contracts';
import { addDays, formatDay, formatSlot, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { PRICE_UNIT_LABELS, type PriceUnit } from '@/features/listings/constants/listing-options';
import {
  type AttributeDef,
  formatAttributeValue,
  formatDuration
} from '@/features/listings/lib/format';

/** Tujuan setelah masuk: hanya jalur internal ("/…", bukan "//…" atau "/\…" yang dibaca browser sebagai situs lain). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

/** "6281234567890" → "0812 •••• 7890". */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const local = phone.startsWith('62') ? `0${phone.slice(2)}` : phone;
  return `${local.slice(0, 4)} •••• ${local.slice(-4)}`;
}

export const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/** "Rp100.000 – Rp150.000 per jam"; null bila harga belum diisi. */
export function priceLabel(min: number | null, max: number | null, unit: string | null) {
  if (min === null && max === null) return null;
  const range =
    min !== null && max !== null && max !== min
      ? `${rupiah(min)} – ${rupiah(max)}`
      : rupiah((min ?? max)!);
  const u = unit ? PRICE_UNIT_LABELS[unit as PriceUnit] : null;
  return u && unit !== 'other' ? `${range} ${u}` : range;
}

/** Tingkat verifikasi untuk warga (PRD 8.14). */
export const VERIFICATION_TEXT: Record<string, string> = {
  unverified: 'Belum diverifikasi',
  contact_checked: 'Kontak dicek',
  visited: 'Dicek langsung'
};

/** Bagian hari. Rentang jam dipakai mencari slot; untuk Ka servis hanya disimpan sebagai keinginan warga. */
export const PERIODS: { key: ServicePeriod; label: string; from: string; to: string }[] = [
  { key: 'pagi', label: 'Pagi', from: '04:00', to: '11:00' },
  { key: 'siang', label: 'Siang', from: '11:00', to: '15:00' },
  { key: 'sore', label: 'Sore', from: '15:00', to: '18:00' },
  { key: 'malam', label: 'Malam', from: '18:00', to: '24:00' }
];
export type PeriodChoice = ServicePeriod | 'semua';

/** Rentang waktu WIB untuk tanggal + bagian hari ("semua" = sehari penuh). */
export function periodWindow(date: string, period: PeriodChoice) {
  const p = PERIODS.find((x) => x.key === period);
  const at = (hhmm: string) =>
    hhmm === '24:00' ? fromJakarta(addDays(date, 1), '00:00') : fromJakarta(date, hhmm);
  return p ? { from: at(p.from), to: at(p.to) } : { from: at('00:00'), to: at('24:00') };
}

/** Pilihan tanggal n hari ke depan (WIB): "Hari ini · Kamis, 15 Okt", "Besok · …", lalu "Sabtu, 17 Okt". */
export function nextDays(n: number, now = new Date()) {
  const today = jakartaDate(now);
  return Array.from({ length: n }, (_, i) => {
    const value = addDays(today, i);
    const day = formatDay(fromJakarta(value, '12:00'));
    return { value, label: i === 0 ? `Hari ini · ${day}` : i === 1 ? `Besok · ${day}` : day };
  });
}

/** "Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00" atau "Servis AC · Kamis, 16 Okt · pagi". */
export function bookingItem(
  b: Pick<BookingView, 'startsAt' | 'endsAt' | 'unit' | 'category' | 'details'>
) {
  if (b.startsAt && b.endsAt)
    return `${b.unit?.name ?? b.category.name} · ${formatSlot(b.startsAt, b.endsAt)}`;
  const { preferredDate, period } = b.details as { preferredDate?: unknown; period?: unknown };
  if (typeof preferredDate !== 'string') return b.category.name;
  return [b.category.name, formatDay(fromJakarta(preferredDate, '12:00')), period]
    .filter(Boolean)
    .join(' · ');
}

/** Status pesanan dengan bahasa sederhana. */
export const STATUS_TEXT: Record<BookingStatus, string> = {
  sent: 'Menunggu jawaban penyedia',
  accepted: 'Diterima',
  in_progress: 'Sedang berjalan',
  completed: 'Selesai',
  rejected: 'Ditolak penyedia',
  expired: 'Kedaluwarsa (tidak dijawab)',
  cancelled: 'Dibatalkan'
};

/** Isian aturan yang punya baris sendiri; sisanya masuk "catatan". */
const RULE_KEYS = new Set(['min_duration', 'cancel_before', 'dp_required']);

/**
 * Ringkasan aturan penting (PRD 8.8) dari isian aturan kategori + nilai listing.
 * snapshot disalin ke bookings.rules_snapshot (dipakai mesin Pesanan untuk batas pembatalan);
 * lines adalah teks yang ditampilkan dan disetujui warga.
 */
export function buildRules(defs: AttributeDef[], values: Record<string, unknown>) {
  const has = (k: string) => defs.some((d) => d.key === k);
  const num = (k: string) =>
    has(k) && typeof values[k] === 'number' ? (values[k] as number) : undefined;
  const snapshot: RulesSnapshot = {};
  const min = num('min_duration');
  if (min) snapshot.minMinutes = min;
  const cancel = num('cancel_before');
  if (cancel !== undefined) snapshot.cancelBeforeMinutes = cancel;
  if (has('dp_required') && typeof values.dp_required === 'boolean')
    snapshot.dpRequired = values.dp_required;
  // Catatan lain yang memengaruhi biaya atau waktu: rupiah, durasi, dan "termasuk …".
  const notes = defs
    .filter(
      (d) =>
        !RULE_KEYS.has(d.key) &&
        (d.type === 'rupiah' ||
          d.type === 'duration' ||
          (d.type === 'boolean' && d.key.endsWith('_included'))) &&
        values[d.key] !== undefined &&
        values[d.key] !== null &&
        values[d.key] !== ''
    )
    .map((d) => `${d.label}: ${formatAttributeValue(d, values[d.key])}`);
  if (notes.length) snapshot.notes = notes;
  return { snapshot, lines: rulesLines(snapshot) };
}

/** Teks aturan dari snapshot (juga untuk "aturan yang kamu setujui" di halaman pesanan). */
export function rulesLines(r: RulesSnapshot): string[] {
  const lines: string[] = [];
  if (r.minMinutes) lines.push(`Durasi minimal ${formatDuration(r.minMinutes)}`);
  if (r.cancelBeforeMinutes !== undefined)
    lines.push(
      r.cancelBeforeMinutes > 0
        ? `Pembatalan paling lambat ${formatDuration(r.cancelBeforeMinutes)} sebelum jadwal`
        : 'Bisa dibatalkan kapan saja sebelum jadwal'
    );
  if (r.dpRequired !== undefined)
    lines.push(r.dpRequired ? 'Wajib bayar DP (uang muka) langsung ke penyedia' : 'Tanpa DP');
  return [...lines, ...(r.notes ?? [])];
}
