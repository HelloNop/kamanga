import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ListingListingPage from '@/features/listings/components/listing-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Listing' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      pageTitle='Listing'
      pageDescription='Kelola jasa, tempat, wisata, dan UMKM yang tampil di Kamanga.'
      pageHeaderAction={
        <div className='flex gap-2'>
          <Link
            href='/dashboard/listings/import'
            className={cn(buttonVariants({ variant: 'outline' }), 'text-xs md:text-sm')}
          >
            Impor CSV
          </Link>
          <Link
            href='/dashboard/listings/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <Icons.add className='mr-2 h-4 w-4' /> Tambah listing
          </Link>
        </div>
      }
    >
      <ListingListingPage />
    </PageContainer>
  );
}
