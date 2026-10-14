'use client';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { bookingKeys, citizenQueueOptions } from '../api/queries';
import { markMessageSent } from '../api/service';

const LABEL: Record<string, string> = {
  booking_accepted: 'Pesanan diterima',
  booking_rejected: 'Pesanan ditolak',
  booking_expired: 'Pesanan kedaluwarsa',
  booking_cancelled: 'Pesanan dibatalkan',
  booking_reminder: 'Pengingat jadwal',
  review_request: 'Minta ulasan',
  question_answered: 'Jawaban pertanyaan'
};

/** Mode cadangan: pesan ke warga dikirim tim dari nomor resmi Kamanga (penyedia tidak boleh melihat nomor warga). */
export function CitizenQueue() {
  const { data } = useSuspenseQuery(citizenQueueOptions());
  const qc = useQueryClient();
  if (!data.length) return null;
  return (
    <section className='bg-card rounded-2xl p-5 shadow-sm'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className='text-[1.0625rem] font-semibold'>Pesan ke warga yang perlu dikirim</h3>
        <span className='text-muted-foreground text-xs'>{data.length} pesan · terlama di atas</span>
      </div>
      <ul className='mt-3 divide-y'>
        {data.map((m) => (
          <li key={m.id} className='flex flex-wrap items-center gap-3 py-3'>
            <div className='min-w-0 flex-1'>
              <span className='font-medium'>{LABEL[m.template] ?? m.template}</span>
              {m.bookingId && m.code && (
                <Link
                  href={`/dashboard/bookings/${m.bookingId}`}
                  className='ml-2 font-mono text-sm underline-offset-4 hover:underline'
                >
                  {m.code}
                </Link>
              )}
            </div>
            <a
              href={m.link}
              target='_blank'
              rel='noopener noreferrer'
              className={buttonVariants({ variant: 'outline' })}
              onClick={async () => {
                await markMessageSent(m.id);
                await qc.invalidateQueries({ queryKey: bookingKeys.citizenQueue() });
              }}
            >
              <Icons.whatsapp aria-hidden /> Kirim lewat WhatsApp
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
