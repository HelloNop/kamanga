import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import CategoryListingPage from '@/features/categories/components/category-listing';
import { AddGroupButton } from '@/features/categories/components/group-dialog';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Kategori' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      pageTitle='Kategori'
      pageDescription='Jenis jasa, tempat, wisata, dan produk. Dipakai untuk mengelompokkan listing dan memahami kata warga.'
      pageHeaderAction={
        <div className='flex gap-2'>
          <AddGroupButton />
          <Link
            href='/dashboard/categories/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <Icons.add className='mr-2 h-4 w-4' /> Tambah kategori
          </Link>
        </div>
      }
    >
      <CategoryListingPage />
    </PageContainer>
  );
}
