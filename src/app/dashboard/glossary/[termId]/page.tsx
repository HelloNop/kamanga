import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { glossaryByIdOptions } from '@/features/glossary/api/queries';
import GlossaryViewPage from '@/features/glossary/components/glossary-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Kamus' };

export default async function Page(props: { params: Promise<{ termId: string }> }) {
  await requireAdmin();
  const { termId } = await props.params;
  if (termId !== 'new' && !/^\d+$/.test(termId)) notFound();

  const queryClient = getQueryClient();
  if (termId !== 'new') void queryClient.prefetchQuery(glossaryByIdOptions(Number(termId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <GlossaryViewPage termId={termId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
