import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { bookingByIdOptions } from '@/features/bookings/api/queries';
import { BookingDetail } from '@/features/bookings/components/booking-detail';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Pesanan' };

export default async function Page(props: { params: Promise<{ bookingId: string }> }) {
  await requireAdmin();
  const { bookingId } = await props.params;
  if (!/^\d+$/.test(bookingId)) notFound();
  const id = Number(bookingId);

  // Ditunggu (bukan prefetch biasa) agar kode pesanan bisa jadi judul halaman; datanya ikut dihidrasi.
  const queryClient = getQueryClient();
  const b = await queryClient.fetchQuery(bookingByIdOptions(id));
  if (!b) notFound();

  return (
    <PageContainer
      pageTitle={`Pesanan ${b.code}`}
      pageDescription={`${b.listing.name} · ${b.category.name}`}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<div className='bg-card h-96 animate-pulse rounded-2xl' />}>
          <BookingDetail id={id} />
        </Suspense>
      </HydrationBoundary>
    </PageContainer>
  );
}
