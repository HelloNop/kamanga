'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Pill } from '@/components/ui/pill';
import { forwardQueueOptions } from '../api/queries';
import { minutesLeft, whenText } from '../lib/status';
import { ForwardButton } from './forward-button';

/** Antrean "Perlu diteruskan": di mode cadangan, tim meneruskan setiap pesanan baru ke penyedia. */
export function ForwardQueue() {
  const { data } = useSuspenseQuery(forwardQueueOptions());
  return (
    <section className='bg-card rounded-2xl p-5 shadow-sm'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className='text-[1.0625rem] font-semibold'>Perlu diteruskan ke penyedia</h3>
        <span className='text-muted-foreground text-xs'>
          {data.length} pesanan menunggu jawaban · sisa waktu tersingkat di atas
        </span>
      </div>
      {data.length === 0 ? (
        <p className='text-muted-foreground mt-3 text-sm'>
          Tidak ada pesanan yang menunggu jawaban.
        </p>
      ) : (
        <ul className='mt-3 divide-y'>
          {data.map((b) => {
            const left = b.respondBy ? minutesLeft(b.respondBy) : null;
            return (
              <li key={b.id} className='flex flex-wrap items-center gap-3 py-3'>
                <div className='min-w-0 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Link
                      href={`/dashboard/bookings/${b.id}`}
                      className='font-mono text-sm font-semibold underline-offset-4 hover:underline'
                    >
                      {b.code}
                    </Link>
                    <span className='font-medium'>{b.listing.name}</span>
                    {left !== null && (
                      <Pill tone={b.stuck ? 'bad' : 'warn'} suppressHydrationWarning>
                        sisa {left} menit
                      </Pill>
                    )}
                    {!b.listing.whatsapp && <Pill tone='bad'>Penyedia tanpa WhatsApp</Pill>}
                  </div>
                  <p className='text-muted-foreground mt-0.5 text-xs'>
                    {[b.category.name, whenText(b), b.district].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <ForwardButton id={b.id} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
