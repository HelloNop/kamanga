import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { type BookingTab, getBookings } from '@/features/mitra/api/service';
import { Empty, NoListing } from '@/features/mitra/components/bits';
import { BookingCard } from '@/features/mitra/components/booking-view';
import { paths } from '@/lib/engines/contracts';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Pesanan' };

const TABS: { key: BookingTab; label: string }[] = [
  { key: 'masuk', label: 'Masuk' },
  { key: 'aktif', label: 'Diterima' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'batal', label: 'Batal' }
];

export default async function BookingsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Pesanan'>
        <NoListing />
      </PageContainer>
    );
  const want = (await props.searchParams).tab;
  const tab = TABS.find((t) => t.key === want)?.key ?? 'masuk';
  const { items, total } = await getBookings(active.id, tab);

  return (
    <PageContainer pageTitle='Pesanan' pageDescription='Terima, tolak, dan tandai pesanan selesai.'>
      <nav aria-label='Jenis pesanan' className='bg-card mb-3 grid grid-cols-4 rounded-xl p-1'>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/mitra/pesanan?tab=${t.key}`}
            aria-current={t.key === tab ? 'page' : undefined}
            className={cn(
              'grid min-h-11 place-items-center rounded-lg text-sm font-semibold',
              t.key === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <div className='space-y-2'>
          {items.map((b) => (
            <BookingCard key={b.id} b={b} href={paths.providerBooking(b.id)} />
          ))}
          {total > items.length && (
            <p className='text-muted-foreground text-center text-xs'>
              Menampilkan {items.length} dari {total} pesanan terbaru.
            </p>
          )}
        </div>
      ) : (
        <Empty>Belum ada pesanan di sini.</Empty>
      )}
    </PageContainer>
  );
}
