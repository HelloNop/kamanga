import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { demandReportOptions } from '@/features/demand/api/queries';
import { DemandReport } from '@/features/demand/components/demand-report';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Permintaan' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(demandReportOptions(30));

  return (
    <PageContainer
      pageTitle='Permintaan'
      pageDescription='Usaha yang dicari warga di chat tetapi belum ada di direktori. Dasar untuk menentukan siapa yang perlu didaftarkan lebih dulu.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DemandReport />
      </HydrationBoundary>
    </PageContainer>
  );
}
