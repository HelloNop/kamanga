import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { listingFormOptions } from '@/features/listings/api/queries';
import SearchConsole from '@/features/search/components/search-console';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Uji Pencarian' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(listingFormOptions());
  return (
    <PageContainer
      pageTitle='Uji Pencarian'
      pageDescription='Coba pencarian seperti warga dan lihat bagaimana skor tiap hasil terbentuk.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <SearchConsole />
      </HydrationBoundary>
    </PageContainer>
  );
}
