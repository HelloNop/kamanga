import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { forwardQueueOptions } from '@/features/bookings/api/queries';
import { BookingTable } from '@/features/bookings/components/booking-tables';
import { ForwardQueue } from '@/features/bookings/components/forward-queue';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Pesanan' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(forwardQueueOptions());

  return (
    <PageContainer
      pageTitle='Pesanan'
      pageDescription='Semua pesanan lintas pintu. Selama WhatsApp masih mode cadangan, tim meneruskan setiap pesanan baru ke penyedia dari nomor resmi Kamanga.'
    >
      <div className='space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<div className='bg-card h-32 animate-pulse rounded-2xl' />}>
            <ForwardQueue />
          </Suspense>
        </HydrationBoundary>
        <BookingTable />
      </div>
    </PageContainer>
  );
}
