import { UserMenu } from '@/components/layout/user-menu';
import { Pill } from '@/components/ui/pill';
import { STATUS_LABELS } from '@/features/listings/constants/listing-options';
import { mitraContext } from '@/features/mitra/api/context';
import { ListingSwitcher, MitraNav } from '@/features/mitra/components/mitra-nav';
import { timed } from '@/features/mitra/lib/format';
import { booking } from '@/lib/engines/contracts';

// Dashboard mitra (PRD 8.12): untuk ponsel, navigasi bawah. Gerbang: mitraContext() → requireVendor().
export default async function MitraPanelLayout({ children }: { children: React.ReactNode }) {
  const { listings, active } = await mitraContext();
  const waiting = active
    ? (await booking.listBookings({ listingIds: [active.id], status: ['sent'], limit: 1 })).total
    : 0;
  return (
    <div className='bg-muted min-h-dvh'>
      <a
        href='#isi'
        className='bg-background sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50'
      >
        Lompat ke isi
      </a>
      <header className='bg-card sticky top-0 z-30 border-b'>
        <div className='mx-auto flex max-w-2xl items-center gap-2 px-3 py-2'>
          <div className='min-w-0 flex-1'>
            {active ? (
              <ListingSwitcher listings={listings} activeId={active.id} />
            ) : (
              <p className='font-bold'>Kamanga Mitra</p>
            )}
            {active && active.status !== 'published' && (
              <Pill tone={active.status === 'rejected' ? 'bad' : 'warn'} className='mt-1'>
                {STATUS_LABELS[active.status]}
              </Pill>
            )}
          </div>
          <UserMenu />
        </div>
      </header>
      <main id='isi' tabIndex={-1} className='mx-auto max-w-2xl px-2 pt-3 pb-28 outline-none'>
        {children}
      </main>
      <MitraNav showSchedule={timed(active?.scheduleKind)} waiting={waiting} />
    </div>
  );
}
