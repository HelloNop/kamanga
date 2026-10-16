// Fungsi murni untuk menampilkan dan menilai pesanan di panel admin. Aman dipakai di server dan klien.
import type { PillTone } from '@/components/ui/pill';
import type { ActorKind, BookingStatus, BookingView } from '@/lib/engines/contracts';
import { formatDay, formatSlot, fromJakarta, jakartaDate } from '@/lib/engines/time';

export const BOOKING_STATUSES: BookingStatus[] = [
  'sent',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'expired',
  'cancelled'
];
export const ACTIVE_STATUSES: BookingStatus[] = ['sent', 'accepted', 'in_progress'];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  sent: 'Menunggu jawaban',
  accepted: 'Diterima',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  rejected: 'Ditolak',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan'
};
export const STATUS_TONES: Record<BookingStatus, PillTone> = {
  sent: 'warn',
  accepted: 'info',
  in_progress: 'info',
  completed: 'ok',
  rejected: 'bad',
  expired: 'mut',
  cancelled: 'mut'
};
export const ACTOR_LABELS: Record<ActorKind, string> = {
  citizen: 'Warga',
  provider: 'Penyedia',
  admin: 'Admin',
  system: 'Sistem'
};

/** Pesanan `sent` dianggap macet bila sisa waktu menjawab tinggal sekian menit. */
export const STUCK_SENT_MINUTES = 10;

export const minutesLeft = (respondBy: Date, now = new Date()) =>
  Math.max(0, Math.ceil((respondBy.getTime() - now.getTime()) / 60_000));

type StuckInput = Pick<BookingView, 'status' | 'respondBy' | 'endsAt' | 'details'>;

/**
 * Alasan pesanan dianggap macet (perlu ditangani admin), null bila tidak:
 * - menunggu jawaban dan batas waktunya hampir habis;
 * - diterima/berjalan tetapi jadwal (atau tanggal permintaan servis) sudah lewat tanpa ditandai selesai.
 */
export function stuckReason(b: StuckInput, now = new Date()): string | null {
  if (b.status === 'sent') {
    if (!b.respondBy) return 'Belum dijawab, tanpa batas waktu';
    const left = minutesLeft(b.respondBy, now);
    return left <= STUCK_SENT_MINUTES ? `Belum dijawab, sisa ${left} menit` : null;
  }
  if (b.status === 'accepted' || b.status === 'in_progress') {
    if (b.endsAt) return b.endsAt < now ? 'Jadwal lewat, belum ditandai selesai' : null;
    const d = b.details?.preferredDate;
    return typeof d === 'string' && d < jakartaDate(now)
      ? 'Tanggal permintaan lewat, belum selesai'
      : null;
  }
  return null;
}

/** "Sabtu, 18 Okt · 19.00–20.00", atau tanggal + bagian hari untuk permintaan servis. */
export function whenText(b: Pick<BookingView, 'startsAt' | 'endsAt' | 'details'>): string {
  if (b.startsAt && b.endsAt) return formatSlot(new Date(b.startsAt), new Date(b.endsAt));
  const { preferredDate, period } = b.details ?? {};
  if (typeof preferredDate !== 'string') return 'Tanpa jadwal';
  return [formatDay(fromJakarta(preferredDate, '12:00')), period].filter(Boolean).join(' · ');
}
