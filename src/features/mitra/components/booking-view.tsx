// Tampilan pesanan untuk penyedia (server component). Kontak warga hanya dirender bila mesin mengisinya
// (setelah pesanan diterima); sebelumnya hanya kecamatan.
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import type { BookingView, ProviderBookingView } from '@/lib/engines/contracts';
import { formatClock } from '@/lib/engines/time';
import { cn } from '@/lib/utils';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  bookingItem,
  detailLines,
  minutesText,
  rupiah,
  timeLeft
} from '../lib/format';
import { Panel } from './bits';

const ACTOR = { citizen: 'Pemesan', provider: 'Penyedia', admin: 'Tim Kamanga', system: 'Sistem' };
const dateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

function meta(b: BookingView) {
  return [
    `#${b.code}`,
    b.seats > 1 && `${b.seats} ${b.category.scheduleKind === 'seat' ? 'kursi' : 'orang'}`,
    b.district && `Kec. ${b.district}`,
    b.price != null && rupiah(b.price)
  ]
    .filter(Boolean)
    .join(' · ');
}

function Deadline({ b }: { b: BookingView }) {
  if (b.status !== 'sent' || !b.respondBy) return null;
  return (
    <p className='mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300'>
      <Icons.clock className='size-4' aria-hidden />
      Jawab sebelum {formatClock(b.respondBy)} ({timeLeft(b.respondBy)})
    </p>
  );
}

/** Kartu ringkas di daftar pesanan. */
export function BookingCard({ b, href }: { b: BookingView; href: string }) {
  return (
    <Link
      href={href}
      className='bg-card focus-visible:ring-ring/50 block rounded-xl p-4 shadow-sm outline-none focus-visible:ring-3'
    >
      <div className='flex items-start justify-between gap-2'>
        <p className='min-w-0 font-semibold'>{bookingItem(b)}</p>
        <Pill tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Pill>
      </div>
      <p className='text-muted-foreground mt-1 text-sm'>{meta(b)}</p>
      <Deadline b={b} />
    </Link>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className='grid grid-cols-[7.5rem_1fr] gap-2 py-1.5 text-sm'>
    <dt className='text-muted-foreground'>{label}</dt>
    <dd className='min-w-0 break-words'>{children}</dd>
  </div>
);

/** Rincian lengkap satu pesanan. `actions` = tombol (komponen klien). */
export function BookingDetail({
  b,
  actions
}: {
  b: ProviderBookingView;
  actions?: React.ReactNode;
}) {
  const rules = b.rulesSnapshot;
  const details = detailLines(b.details);
  const c = b.contact;
  return (
    <div className='space-y-3'>
      <Panel>
        <div className='flex items-start justify-between gap-2'>
          <h3 className='min-w-0 text-[1.0625rem] font-semibold'>{bookingItem(b)}</h3>
          <Pill tone={BOOKING_STATUS_TONE[b.status]}>{BOOKING_STATUS_LABEL[b.status]}</Pill>
        </div>
        <Deadline b={b} />
        <dl className='mt-2 divide-y'>
          <Row label='Nomor pesanan'>#{b.code}</Row>
          <Row label='Usaha'>{b.listing.name}</Row>
          {b.seats > 1 && (
            <Row label={b.category.scheduleKind === 'seat' ? 'Kursi' : 'Jumlah orang'}>
              {b.seats}
            </Row>
          )}
          <Row label='Kecamatan'>{b.district ?? '-'}</Row>
          {b.price != null && <Row label='Harga tertera'>{rupiah(b.price)}</Row>}
          {details.length > 0 && <Row label='Rincian'>{details.join(' · ')}</Row>}
          {!!(
            rules.minMinutes ||
            rules.cancelBeforeMinutes ||
            rules.dpRequired ||
            rules.notes?.length
          ) && (
            <Row label='Aturan disetujui'>
              {[
                rules.minMinutes && `Minimal ${minutesText(rules.minMinutes)}`,
                rules.cancelBeforeMinutes &&
                  `Batal paling lambat ${minutesText(rules.cancelBeforeMinutes)} sebelumnya`,
                rules.dpRequired && 'Wajib DP',
                ...(rules.notes ?? [])
              ]
                .filter(Boolean)
                .join(' · ')}
            </Row>
          )}
        </dl>
        {actions}
      </Panel>

      <Panel title='Pemesan'>
        {c ? (
          <>
            <dl className='divide-y'>
              <Row label='Nama'>{c.name}</Row>
              <Row label='WhatsApp'>+{c.phone}</Row>
              {c.address && <Row label='Alamat'>{c.address}</Row>}
              {c.note && <Row label='Patokan'>{c.note}</Row>}
            </dl>
            <div className='mt-3 grid grid-cols-2 gap-2'>
              <a
                href={`https://wa.me/${c.phone}`}
                target='_blank'
                rel='noopener noreferrer'
                className={buttonVariants({ variant: 'outline' })}
              >
                <Icons.whatsapp aria-hidden /> WhatsApp
              </a>
              <a href={`tel:+${c.phone}`} className={buttonVariants({ variant: 'outline' })}>
                <Icons.phone aria-hidden /> Telepon
              </a>
              {c.point && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${c.point.lat},${c.point.lng}`}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={cn(buttonVariants({ variant: 'outline' }), 'col-span-2')}
                >
                  <Icons.mapPin aria-hidden /> Buka lokasi di peta
                </a>
              )}
            </div>
          </>
        ) : (
          <p className='text-muted-foreground flex gap-2 text-sm'>
            <Icons.lock className='mt-0.5 size-4 shrink-0' aria-hidden />
            {b.status === 'sent'
              ? 'Nama, nomor, dan alamat pemesan terlihat setelah Anda menerima pesanan. Sebelum itu hanya kecamatannya.'
              : 'Kontak pemesan tidak ditampilkan untuk pesanan ini.'}
          </p>
        )}
      </Panel>

      {b.review && (
        <Panel title='Ulasan'>
          <p className='text-sm font-semibold'>
            {b.review.satisfied ? 'Puas' : 'Kurang puas'}
            {b.review.stars ? ` · ${b.review.stars} dari 5 bintang` : ''}
          </p>
          {b.review.comment && <p className='mt-1 text-sm'>{b.review.comment}</p>}
        </Panel>
      )}

      <Panel title='Riwayat'>
        <ol className='space-y-2 text-sm'>
          {b.events.map((e, i) => (
            <li key={i} className='flex gap-2'>
              <span className='text-muted-foreground w-28 shrink-0'>{dateTime.format(e.at)}</span>
              <span className='min-w-0'>
                {BOOKING_STATUS_LABEL[e.toStatus]} · {ACTOR[e.actor]}
                {e.reason && <span className='text-muted-foreground'> · {e.reason}</span>}
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
