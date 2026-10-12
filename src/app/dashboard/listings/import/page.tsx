import PageContainer from '@/components/layout/page-container';
import ListingImport from '@/features/listings/components/listing-import';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Impor listing' };

export default async function Page() {
  await requireAdmin();
  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <ListingImport />
      </div>
    </PageContainer>
  );
}
