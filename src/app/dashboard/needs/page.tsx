import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import NeedListingPage from '@/features/needs/components/need-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Kebutuhan' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      pageTitle='Kebutuhan'
      pageDescription='Situasi warga, mis. Pesta Pernikahan atau AC Rusak, beserta sebutan lainnya dan kategori yang dicarikan.'
      pageHeaderAction={
        <Link href='/dashboard/needs/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
          <Icons.add className='mr-2 h-4 w-4' /> Tambah kebutuhan
        </Link>
      }
    >
      <NeedListingPage />
    </PageContainer>
  );
}
