import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { categoryByIdOptions, categoryGroupsOptions } from '@/features/categories/api/queries';
import CategoryViewPage from '@/features/categories/components/category-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Kategori' };

export default async function Page(props: { params: Promise<{ categoryId: string }> }) {
  await requireAdmin();
  const { categoryId } = await props.params;
  if (categoryId !== 'new' && !/^\d+$/.test(categoryId)) notFound();

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(categoryGroupsOptions());
  if (categoryId !== 'new') void queryClient.prefetchQuery(categoryByIdOptions(Number(categoryId)));

  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CategoryViewPage categoryId={categoryId} />
        </HydrationBoundary>
      </div>
    </PageContainer>
  );
}
