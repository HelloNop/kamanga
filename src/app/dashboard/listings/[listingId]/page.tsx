import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { listingByIdOptions, listingFormOptions } from '@/features/listings/api/queries';
import { ListingTabs } from '@/features/listings/components/listing-tabs';
import ListingViewPage from '@/features/listings/components/listing-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Listing' };

export default async function Page(props: { params: Promise<{ listingId: string }> }) {
  await requireAdmin();
  const { listingId } = await props.params;
  if (listingId !== 'new' && !/^\d+$/.test(listingId)) notFound();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(listingFormOptions());
  if (listingId !== 'new') void queryClient.prefetchQuery(listingByIdOptions(Number(listingId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        {listingId !== 'new' && <ListingTabs listingId={Number(listingId)} />}
        <HydrationBoundary state={dehydrate(queryClient)}>
          <ListingViewPage listingId={listingId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
