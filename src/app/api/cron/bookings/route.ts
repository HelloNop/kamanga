// Putaran berkala Mesin Pesanan: kedaluwarsakan pesanan yang tidak dijawab, lalu kirim pengingat.
// Dipanggil penjadwal (crontab / pemantau uptime) tiap menit:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/bookings
// Alternatif tanpa HTTP: bun run scripts/bookings-tick.ts
import { createHash, timingSafeEqual } from 'node:crypto';
import { booking } from '@/lib/engines/contracts';

const digest = (s: string) => createHash('sha256').update(s).digest();

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return Response.json({ ok: false, message: 'CRON_SECRET belum diatur' }, { status: 503 });
  // Bandingkan hash agar panjang sama dan waktunya konstan.
  const given = digest(request.headers.get('authorization') ?? '');
  if (!timingSafeEqual(given, digest(`Bearer ${secret}`)))
    return Response.json({ ok: false, message: 'Tidak diizinkan' }, { status: 401 });

  const now = new Date();
  const { expired } = await booking.expireStaleBookings(now);
  const { sent } = await booking.runReminders(now);
  return Response.json({ ok: true, expired: expired.length, reminders: sent });
}
