import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { myListingsOptions } from '@/features/vendor/api/queries';
import { MyListings } from '@/features/vendor/components/my-listings';
import { getQueryClient } from '@/lib/query-client';
import { requireVendor } from '@/lib/session';

export const metadata = { title: 'Usaha & layanan' };

export default async function BusinessesPage() {
  await requireVendor();
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(myListingsOptions());
  return (
    <PageContainer
      pageTitle='Usaha & layanan'
      pageDescription='Profil, foto, layanan dan harga, area layanan, kontak, dan isian aturan.'
      pageHeaderAction={
        <Link href='/mitra/usaha/baru' className={buttonVariants()}>
          <Icons.add aria-hidden /> Tambah usaha
        </Link>
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyListings />
      </HydrationBoundary>
    </PageContainer>
  );
}
