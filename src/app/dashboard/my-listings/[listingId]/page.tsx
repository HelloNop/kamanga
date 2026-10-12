import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { myListingByIdOptions, vendorFormOptions } from '@/features/vendor/api/queries';
import VendorListingPage from '@/features/vendor/components/vendor-listing-page';
import { getQueryClient } from '@/lib/query-client';
import { requireVendor } from '@/lib/session';

export const metadata = { title: 'Listing saya' };

export default async function Page(props: { params: Promise<{ listingId: string }> }) {
  await requireVendor();
  const { listingId } = await props.params;
  if (listingId !== 'new' && !/^\d+$/.test(listingId)) notFound();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(vendorFormOptions());
  if (listingId !== 'new') void queryClient.prefetchQuery(myListingByIdOptions(Number(listingId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <VendorListingPage listingId={listingId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
