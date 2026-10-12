import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { locationByIdOptions, locationFormOptions } from '@/features/locations/api/queries';
import LocationViewPage from '@/features/locations/components/location-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Lokasi' };

export default async function Page(props: { params: Promise<{ locationId: string }> }) {
  await requireAdmin();
  const { locationId } = await props.params;
  if (locationId !== 'new' && !/^\d+$/.test(locationId)) notFound();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(locationFormOptions());
  if (locationId !== 'new') void queryClient.prefetchQuery(locationByIdOptions(Number(locationId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <LocationViewPage locationId={locationId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
