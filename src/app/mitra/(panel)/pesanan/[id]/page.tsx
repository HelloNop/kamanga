import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { getBooking } from '@/features/mitra/api/service';
import { BookingActions } from '@/features/mitra/components/booking-actions';
import { BookingDetail } from '@/features/mitra/components/booking-view';

export const metadata = { title: 'Pesanan' };

export default async function BookingPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^\d+$/.test(id)) notFound();
  // Mesin hanya mengembalikan pesanan milik mitra ini; kontak warga terisi setelah diterima.
  const b = await getBooking(Number(id));
  if (!b) notFound();
  return (
    <PageContainer pageTitle={`Pesanan #${b.code}`}>
      <Link
        href='/mitra/pesanan'
        className='text-muted-foreground mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold'
      >
        <Icons.chevronLeft className='size-4' aria-hidden /> Semua pesanan
      </Link>
      <BookingDetail
        b={b}
        actions={
          <BookingActions
            target={{ id: b.id }}
            status={b.status}
            canComplete={!b.startsAt || b.startsAt <= new Date()}
          />
        }
      />
    </PageContainer>
  );
}
