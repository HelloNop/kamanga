// Status satu pesanan warga (PRD 8.5, 8.7): bahasa sederhana, riwayat, batal, alternatif, dan ulasan.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons } from '@/components/icons';
import {
  AutoRefresh,
  CancelBooking,
  ReviewForm
} from '@/features/warga/components/booking-actions';
import { PublicHeader } from '@/features/jelajah/components/public-header';
import { bookingItem, rulesLines, rupiah, STATUS_TEXT } from '@/features/warga/lib/format';
import { formatDuration } from '@/features/listings/lib/format';
import { booking, type BookingStatus, paths } from '@/lib/engines/contracts';
import { formatClock, formatDay } from '@/lib/engines/time';
import { requireCitizen } from '@/lib/session';

export const metadata: Metadata = { title: 'Status pesanan' };

const ACTOR: Record<string, string> = {
  citizen: 'kamu',
  provider: 'penyedia',
  admin: 'tim Kamanga',
  system: 'sistem'
};
const TONE: Record<BookingStatus, string> = {
  sent: '',
  accepted: 'ok',
  in_progress: 'ok',
  completed: 'done',
  rejected: 'bad',
  expired: 'bad',
  cancelled: 'done'
};

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const session = await requireCitizen(paths.citizenBooking(Number(raw) || 0));
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const b = await booking.getBookingForCitizen(id, session.user.id);
  if (!b) notFound();

  const last = b.events.at(-1);
  const minutesLeft =
    b.status === 'sent' && b.respondBy
      ? Math.max(1, Math.ceil((b.respondBy.getTime() - Date.now()) / 60_000))
      : null;
  const alternatives =
    b.status === 'rejected' || b.status === 'expired'
      ? await booking.findAlternatives(b.id, 3)
      : [];
  const extra = Object.entries(b.details).filter(
    ([k, v]) =>
      !['problem', 'preferredDate', 'period'].includes(k) && v !== null && typeof v !== 'object'
  );
  const cancelRule =
    b.rulesSnapshot.cancelBeforeMinutes !== undefined && b.rulesSnapshot.cancelBeforeMinutes > 0
      ? `Aturan yang kamu setujui: pembatalan paling lambat ${formatDuration(b.rulesSnapshot.cancelBeforeMinutes)} sebelum jadwal.`
      : null;
  const rules = rulesLines(b.rulesSnapshot);

  return (
    <div className='kmg warga'>
      <PublicHeader />
      <main className='w-main'>
        <Link className='w-back' href={paths.citizenBookings()}>
          <Icons.chevronLeft size={18} aria-hidden='true' />
          Pesanan saya
        </Link>
        <h1 className='w-title'>{b.listing.name}</h1>
        <p className='w-lead'>{bookingItem(b)}</p>

        <div className={`w-status ${TONE[b.status]}`} role='status'>
          <b>{STATUS_TEXT[b.status]}</b>
          {b.status === 'sent' && (
            <span>
              Pesanan terkirim. Penyedia punya waktu {minutesLeft} menit untuk menjawab. Halaman ini
              diperbarui sendiri.
            </span>
          )}
          {b.status === 'accepted' && (
            <span>Penyedia sudah menerima pesananmu dan akan menghubungimu lewat WhatsApp.</span>
          )}
          {(b.status === 'rejected' || b.status === 'cancelled') && last?.reason && (
            <span>Alasan: {last.reason}</span>
          )}
          {b.status === 'expired' && <span>Penyedia tidak menjawab dalam batas waktu.</span>}
        </div>
        {b.status === 'sent' && <AutoRefresh />}

        {(b.status === 'accepted' || b.status === 'in_progress') && b.listing.whatsapp && (
          <div className='w-actions'>
            <a
              className='w-btn dark block'
              href={`https://wa.me/${b.listing.whatsapp}?text=${encodeURIComponent(`Halo, saya pemesan #${b.code} dari Kamanga.`)}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              <Icons.whatsapp size={18} aria-hidden='true' />
              Chat penyedia
            </a>
          </div>
        )}

        {alternatives.length > 0 && (
          <section>
            <h2 className='w-h2'>Coba penyedia lain</h2>
            <ul className='w-list'>
              {alternatives.map((a) => (
                <li key={a.listingId}>
                  <Link className='w-item' href={paths.bookingStart(a.slug)}>
                    <b>{a.name}</b>
                    <span className='w-muted'>Pesan di sini</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {b.status === 'completed' &&
          (b.review ? (
            <p className='w-alert ok'>
              Terima kasih atas ulasanmu: {b.review.satisfied ? 'Puas' : 'Kurang puas'}
              {b.review.stars ? `, ${b.review.stars} bintang` : ''}.
            </p>
          ) : (
            <section>
              <h2 className='w-h2'>Bagaimana layanannya?</h2>
              <ReviewForm id={b.id} />
            </section>
          ))}

        <section>
          <h2 className='w-h2'>Rincian</h2>
          <dl className='w-dl'>
            <div>
              <dt>Kode pesanan</dt>
              <dd>#{b.code}</dd>
            </div>
            <div>
              <dt>Penyedia</dt>
              <dd>
                <Link href={paths.listing(b.listing.slug)}>{b.listing.name}</Link> ·{' '}
                {b.category.name}
              </dd>
            </div>
            {b.seats > 1 && (
              <div>
                <dt>Jumlah</dt>
                <dd>{b.seats} orang</dd>
              </div>
            )}
            {typeof b.details.problem === 'string' && (
              <div>
                <dt>Keluhan</dt>
                <dd>{b.details.problem}</dd>
              </div>
            )}
            {extra.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v === true ? 'ya' : v === false ? 'tidak' : String(v)}</dd>
              </div>
            ))}
            {b.district && (
              <div>
                <dt>Kecamatan</dt>
                <dd>{b.district}</dd>
              </div>
            )}
            {b.price !== null && (
              <div>
                <dt>Harga tertera</dt>
                <dd>{rupiah(b.price)} (dibayar langsung ke penyedia)</dd>
              </div>
            )}
          </dl>
        </section>

        {rules.length > 0 && (
          <section className='w-rules'>
            <h2>Aturan yang kamu setujui</h2>
            <ul>
              {rules.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className='w-h2'>Riwayat</h2>
          <ol className='w-timeline'>
            {b.events.map((e, i) => (
              <li key={i}>
                <b>{STATUS_TEXT[e.toStatus]}</b>
                <br />
                <span className='w-muted'>
                  {formatDay(e.at)}, {formatClock(e.at)} · oleh {ACTOR[e.actor] ?? e.actor}
                  {e.reason ? ` · ${e.reason}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {(b.status === 'sent' || b.status === 'accepted') && (
          <div className='w-actions'>
            <CancelBooking id={b.id} rules={cancelRule} />
          </div>
        )}
      </main>
    </div>
  );
}
