import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import ListingListingPage from '@/features/listings/components/listing-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Penyedia & Tempat' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const sp = await props.searchParams;
  searchParamsCache.parse(sp);
  // `kind` belum ada di searchParamsCache bersama; dibaca langsung.
  const kind = typeof sp.kind === 'string' ? sp.kind : undefined;

  return (
    <PageContainer
      pageTitle='Penyedia & Tempat'
      pageDescription='Penyedia bisa dipesan lewat Kamanga; Tempat hanya informasi (kafe, wisata, apotek 24 jam, IGD).'
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
      <ListingListingPage kind={kind} />
    </PageContainer>
  );
}
