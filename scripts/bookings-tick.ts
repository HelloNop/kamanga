// Satu putaran Mesin Pesanan: kedaluwarsakan pesanan yang tidak dijawab, kirim pengingat, selesai otomatis.
// Jalankan tiap menit dari crontab VPS, mis.:
//   * * * * * cd /srv/kamanga && bun run scripts/bookings-tick.ts >> /var/log/kamanga-tick.log 2>&1
// Alternatif lewat HTTP: POST /api/cron/bookings dengan header Authorization: Bearer <CRON_SECRET>.
import { booking } from '@/lib/engines/contracts';

const now = new Date();
try {
  const { expired } = await booking.expireStaleBookings(now);
  const { sent } = await booking.runReminders(now);
  console.log(`[bookings-tick] ${now.toISOString()} kedaluwarsa: ${expired.length}, pengingat: ${sent}`);
  process.exit(0);
} catch (e) {
  console.error('[bookings-tick] gagal', e);
  process.exit(1);
}
