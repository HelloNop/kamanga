// Pesanan warga: yang masih aktif dan riwayat (PRD 8.7).
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicHeader } from '@/features/jelajah/components/public-header';
import { bookingItem, STATUS_TEXT } from '@/features/warga/lib/format';
import { ACTIVE_BOOKING_STATUSES, booking, type BookingView, paths } from '@/lib/engines/contracts';
import { requireCitizen } from '@/lib/session';

export const metadata: Metadata = { title: 'Pesanan saya' };

const active = (b: BookingView) =>
  (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(b.status);

function List({ items }: { items: BookingView[] }) {
  return (
    <ul className='w-list'>
      {items.map((b) => (
        <li key={b.id}>
          <Link className='w-item' href={paths.citizenBooking(b.id)}>
            <b>{b.listing.name}</b>
            <span className='w-muted'>{bookingItem(b)}</span>
            <span className='w-row' style={{ gap: 6 }}>
              <span
                className={`w-badge ${active(b) ? '' : b.status === 'completed' ? 'ok' : 'muted'}`}
              >
                {STATUS_TEXT[b.status]}
              </span>
              {b.status === 'completed' && !b.review && (
                <span className='w-badge warn'>Beri ulasan</span>
              )}
              <span className='w-muted'>#{b.code}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function BookingsPage() {
  const session = await requireCitizen(paths.citizenBookings());
  const { items } = await booking.listBookings({ citizenId: session.user.id, limit: 100 });
  const now = items.filter(active);
  const past = items.filter((b) => !active(b));
  return (
    <div className='kmg warga'>
      <PublicHeader />
      <main className='w-main'>
        <h1 className='w-title'>Pesanan saya</h1>
        {!items.length && (
          <p className='w-alert info'>
            Belum ada pesanan. <Link href='/'>Mulai dari beranda</Link>.
          </p>
        )}
        {now.length > 0 && (
          <section>
            <h2 className='w-h2'>Aktif</h2>
            <List items={now} />
          </section>
        )}
        {past.length > 0 && (
          <section>
            <h2 className='w-h2'>Riwayat</h2>
            <List items={past} />
          </section>
        )}
      </main>
    </div>
  );
}
