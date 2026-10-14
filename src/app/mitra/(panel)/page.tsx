import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { getHome } from '@/features/mitra/api/service';
import { Empty, NoListing, Panel } from '@/features/mitra/components/bits';
import { BookingCard } from '@/features/mitra/components/booking-view';
import { paths } from '@/lib/engines/contracts';

export const metadata = { title: 'Beranda' };

const MONTH = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'long' });

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className='bg-muted/60 rounded-xl p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-0.5 text-2xl font-semibold'>{value}</div>
    </div>
  );
}

export default async function MitraHome() {
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Beranda' pageDescription='Selamat datang di Kamanga Mitra.'>
        <NoListing />
      </PageContainer>
    );
  const home = await getHome(active.id);

  return (
    <PageContainer pageTitle='Beranda' pageDescription={active.categoryName ?? active.name}>
      <div className='space-y-3'>
        {home.tasks.length > 0 && (
          <Panel title='Perlu dikerjakan'>
            <ul className='-mx-1'>
              {home.tasks.map((t) => (
                <li key={t.key}>
                  <Link
                    href={t.href}
                    className='hover:bg-muted flex min-h-11 items-center gap-2 rounded-lg px-1 py-2 text-sm'
                  >
                    <Icons.listCheck className='text-primary size-5 shrink-0' aria-hidden />
                    <span className='min-w-0 flex-1'>{t.text}</span>
                    <Icons.chevronRight className='text-muted-foreground size-4' aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title={`Menunggu jawaban (${home.waiting.length})`}>
          {home.waiting.length ? (
            <div className='space-y-2'>
              {home.waiting.map((b) => (
                <BookingCard key={b.id} b={b} href={paths.providerBooking(b.id)} />
              ))}
            </div>
          ) : (
            <Empty>Tidak ada pesanan yang menunggu jawaban.</Empty>
          )}
        </Panel>

        <Panel title='Pesanan hari ini'>
          {home.today.length ? (
            <div className='space-y-2'>
              {home.today.map((b) => (
                <BookingCard key={b.id} b={b} href={paths.providerBooking(b.id)} />
              ))}
            </div>
          ) : (
            <Empty>Belum ada pesanan untuk hari ini.</Empty>
          )}
        </Panel>

        <Panel title={`Bulan ${MONTH.format(new Date())}`}>
          <div className='grid grid-cols-2 gap-2'>
            <Stat label='Dipesan' value={home.month.booked} />
            <Stat label='Diterima' value={home.month.accepted} />
            <Stat label='Selesai' value={home.month.completed} />
            <Stat label='Pelanggan baru' value={home.month.newCustomers} />
          </div>
        </Panel>
      </div>
    </PageContainer>
  );
}
