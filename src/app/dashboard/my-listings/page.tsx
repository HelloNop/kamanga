import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { myListingsOptions } from '@/features/vendor/api/queries';
import { MyListings } from '@/features/vendor/components/my-listings';
import { getQueryClient } from '@/lib/query-client';
import { requireVendor } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Listing saya' };

export default async function Page() {
  await requireVendor();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(myListingsOptions());

  return (
    <PageContainer
      pageTitle='Listing saya'
      pageDescription='Usaha Anda yang terdaftar di Kamanga dan status pemeriksaannya.'
      pageHeaderAction={
        <Link
          href='/dashboard/my-listings/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <Icons.add className='mr-2 h-4 w-4' /> Tambah listing
        </Link>
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyListings />
      </HydrationBoundary>
    </PageContainer>
  );
}
