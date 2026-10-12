import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import GlossaryListingPage from '@/features/glossary/components/glossary-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Kamus' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      pageTitle='Kamus'
      pageDescription='Kata sehari-hari dan bahasa Minang beserta artinya, untuk melatih chatbot memahami warga. Sebutan lain untuk kategori, kebutuhan, dan lokasi ada di menu masing-masing.'
      pageHeaderAction={
        <Link href='/dashboard/glossary/new' className={cn(buttonVariants(), 'text-xs md:text-sm')}>
          <Icons.add className='mr-2 h-4 w-4' /> Tambah kata
        </Link>
      }
    >
      <GlossaryListingPage />
    </PageContainer>
  );
}
