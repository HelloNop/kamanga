import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { doorByIdOptions } from '@/features/doors/api/queries';
import DoorViewPage from '@/features/doors/components/door-view-page';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Pintu' };

export default async function Page(props: { params: Promise<{ doorId: string }> }) {
  await requireAdmin();
  const { doorId } = await props.params;
  if (doorId !== 'new' && !/^\d+$/.test(doorId)) notFound();

  const queryClient = getQueryClient();
  if (doorId !== 'new') void queryClient.prefetchQuery(doorByIdOptions(Number(doorId)));

  return (
    <PageContainer pageTitle={doorId === 'new' ? 'Tambah pintu' : 'Ubah pintu'}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DoorViewPage doorId={doorId} />
      </HydrationBoundary>
    </PageContainer>
  );
}
