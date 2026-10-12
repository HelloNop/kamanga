import type { SearchParams } from 'nuqs/server';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import LocationListingPage from '@/features/locations/components/location-listing';
import { searchParamsCache } from '@/lib/searchparams';
import { requireAdmin } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Lokasi' };

export default async function Page(props: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  searchParamsCache.parse(await props.searchParams);

  return (
    <PageContainer
      pageTitle='Lokasi'
      pageDescription='Daftar nama tempat Sumatera Barat beserta sebutan populernya. Dipakai chatbot untuk mengenali lokasi dan menghitung jarak.'
      pageHeaderAction={
        <div className='flex gap-2'>
          <Link
            href='/dashboard/locations/import'
            className={cn(buttonVariants({ variant: 'outline' }), 'text-xs md:text-sm')}
          >
            Impor CSV
          </Link>
          <Link
            href='/dashboard/locations/new'
            className={cn(buttonVariants(), 'text-xs md:text-sm')}
          >
            <Icons.add className='mr-2 h-4 w-4' /> Tambah lokasi
          </Link>
        </div>
      }
    >
      <LocationListingPage />
    </PageContainer>
  );
}
