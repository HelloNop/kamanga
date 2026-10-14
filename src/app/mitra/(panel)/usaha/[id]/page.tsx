import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { myListingByIdOptions, vendorFormOptions } from '@/features/vendor/api/queries';
import VendorListingPage from '@/features/vendor/components/vendor-listing-page';
import { getQueryClient } from '@/lib/query-client';
import { requireVendor } from '@/lib/session';

export const metadata = { title: 'Usaha & layanan' };

// Formulir listing yang sama dengan portal vendor lama (src/features/listings, mode vendor).
export default async function BusinessFormPage(props: { params: Promise<{ id: string }> }) {
  await requireVendor();
  const { id } = await props.params;
  if (id !== 'baru' && !/^\d+$/.test(id)) notFound();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(vendorFormOptions());
  if (id !== 'baru') void queryClient.prefetchQuery(myListingByIdOptions(Number(id)));
  return (
    <div className='bg-muted rounded-3xl p-3 sm:p-4'>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <VendorListingPage listingId={id === 'baru' ? 'new' : id} />
      </HydrationBoundary>
    </div>
  );
}
