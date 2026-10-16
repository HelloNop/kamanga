import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';
import PageContainer from '@/components/layout/page-container';
import { demandReportOptions, unansweredQuestionsOptions } from '@/features/demand/api/queries';
import { DemandReport } from '@/features/demand/components/demand-report';
import { UnansweredQuestions } from '@/features/demand/components/unanswered-questions';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Permintaan' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(demandReportOptions(30));
  void queryClient.prefetchQuery(unansweredQuestionsOptions());

  return (
    <PageContainer
      pageTitle='Permintaan'
      pageDescription='Pertanyaan warga yang belum dijawab penyedia, dan usaha yang dicari warga tetapi belum ada di direktori.'
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className='space-y-4'>
          <Suspense fallback={<div className='bg-card h-32 animate-pulse rounded-2xl' />}>
            <UnansweredQuestions />
          </Suspense>
          <DemandReport />
        </div>
      </HydrationBoundary>
    </PageContainer>
  );
}
