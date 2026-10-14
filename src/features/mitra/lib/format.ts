// Teks dan format untuk dashboard mitra. Murni (tanpa database), aman di server maupun klien.
import type { PillTone } from '@/components/ui/pill';
import type { BookingStatus, BookingView, ScheduleKind } from '@/lib/engines/contracts';
import { formatDay, formatSlot, fromJakarta } from '@/lib/engines/time';

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  sent: 'Menunggu jawaban',
  accepted: 'Diterima',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  rejected: 'Ditolak',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan'
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, PillTone> = {
  sent: 'warn',
  accepted: 'info',
  in_progress: 'info',
  completed: 'ok',
  rejected: 'bad',
  expired: 'mut',
  cancelled: 'mut'
};

export const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export const timed = (k: ScheduleKind | null | undefined) => k === 'slot' || k === 'seat';

export const rupiah = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;

/** "90 menit" → "1 jam 30 menit". */
export function minutesText(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h && `${h} jam`, r && `${r} menit`].filter(Boolean).join(' ') || '0 menit';
}

/** Sisa waktu menjawab: "sisa 12 menit", atau "waktu habis". */
export function timeLeft(respondBy: Date | null, now = Date.now()) {
  if (!respondBy) return null;
  const m = Math.ceil((respondBy.getTime() - now) / 60_000);
  return m > 0 ? `sisa ${minutesText(m)}` : 'waktu habis';
}

/** "Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00" atau "Servis AC · Kamis, 16 Okt · pagi". */
export function bookingItem(
  b: Pick<BookingView, 'unit' | 'category' | 'startsAt' | 'endsAt' | 'details'>
) {
  if (b.startsAt && b.endsAt)
    return `${b.unit?.name ?? b.category.name} · ${formatSlot(b.startsAt, b.endsAt)}`;
  const { preferredDate, period } = b.details;
  const day =
    typeof preferredDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(preferredDate)
      ? formatDay(fromJakarta(preferredDate, '12:00'))
      : null;
  return [b.category.name, day, typeof period === 'string' ? period : null]
    .filter(Boolean)
    .join(' · ');
}

/** Rincian pesanan sebagai daftar baris: "Keluhan: AC tidak dingin", "sewa raket: ya". */
export function detailLines(details: Record<string, unknown>) {
  const out: string[] = [];
  for (const [k, v] of Object.entries(details)) {
    if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
    if (k === 'preferredDate' || k === 'period') continue; // sudah ada di bookingItem
    const val = v === true ? 'ya' : v === false ? 'tidak' : String(v);
    out.push(k === 'problem' ? `Keluhan: ${val}` : `${k}: ${val}`);
  }
  return out;
}
