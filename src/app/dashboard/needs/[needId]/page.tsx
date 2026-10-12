import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { needByIdOptions, needFormOptions } from '@/features/needs/api/queries';
import NeedViewPage from '@/features/needs/components/need-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Kebutuhan' };

export default async function Page(props: { params: Promise<{ needId: string }> }) {
  await requireAdmin();
  const { needId } = await props.params;
  if (needId !== 'new' && !/^\d+$/.test(needId)) notFound();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(needFormOptions());
  if (needId !== 'new') void queryClient.prefetchQuery(needByIdOptions(Number(needId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <NeedViewPage needId={needId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
