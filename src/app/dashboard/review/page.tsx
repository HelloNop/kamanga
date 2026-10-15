import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { claimQueueOptions, reviewQueueOptions } from '@/features/review/api/queries';
import { ClaimQueue } from '@/features/review/components/claim-queue';
import { ReviewQueue } from '@/features/review/components/review-queue';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Antrean review' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(reviewQueueOptions());
  void queryClient.prefetchQuery(claimQueueOptions());

  return (
    <PageContainer
      pageTitle='Antrean review'
      pageDescription='Klaim usaha dan listing yang menunggu persetujuan sebelum tampil ke warga dan chatbot.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ClaimQueue />
        <ReviewQueue />
      </HydrationBoundary>
    </PageContainer>
  );
}
