import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { overviewQueryOptions } from '@/features/overview/api/queries';
import { OverviewSkeleton, OverviewStats } from '@/features/overview/components/overview-stats';
import { vendorSummaryOptions } from '@/features/vendor/api/queries';
import { VendorOverview } from '@/features/vendor/components/vendor-overview';
import { getQueryClient } from '@/lib/query-client';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Ringkasan' };

export default async function Page() {
  const session = await requireSession();
  const isAdmin = session.user.role === 'admin';

  const queryClient = getQueryClient();
  if (isAdmin) void queryClient.prefetchQuery(overviewQueryOptions());
  else void queryClient.prefetchQuery(vendorSummaryOptions());

  return (
    <PageContainer
      pageTitle='Ringkasan'
      pageDescription={
        isAdmin
          ? 'Pesanan hari ini, hal yang perlu ditangani, kondisi direktori, dan pemakaian chat.'
          : 'Ringkasan usaha Anda di Kamanga.'
      }
    >
      {isAdmin ? (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<OverviewSkeleton />}>
            <OverviewStats />
          </Suspense>
        </HydrationBoundary>
      ) : (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<OverviewSkeleton />}>
            <VendorOverview />
          </Suspense>
        </HydrationBoundary>
      )}
    </PageContainer>
  );
}
