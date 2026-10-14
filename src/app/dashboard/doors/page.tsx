import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { doorsQueryOptions } from '@/features/doors/api/queries';
import { DoorList } from '@/features/doors/components/door-list';
import { getQueryClient } from '@/lib/query-client';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Pintu' };

export default async function Page() {
  await requireAdmin();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(doorsQueryOptions());

  return (
    <PageContainer
      pageTitle='Pintu'
      pageDescription='Tombol "Ka-" di beranda warga. Urutan, nama, ikon, dan status di sini langsung dipakai beranda. Kategori masuk ke pintu lewat formulir kategori.'
      pageHeaderAction={
        <Link href='/dashboard/doors/new' className={buttonVariants()}>
          <Icons.add className='mr-2 size-4' /> Tambah pintu
        </Link>
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <DoorList />
      </HydrationBoundary>
    </PageContainer>
  );
}
