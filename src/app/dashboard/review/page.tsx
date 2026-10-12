import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { reviewQueueOptions } from '@/features/review/api/queries';
import { ReviewQueue } from '@/features/review/components/review-queue';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Antrean review' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(reviewQueueOptions());

  return (
    <PageContainer
      pageTitle='Antrean review'
      pageDescription='Listing yang menunggu persetujuan sebelum tampil ke warga dan chatbot.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ReviewQueue />
      </HydrationBoundary>
    </PageContainer>
  );
}
