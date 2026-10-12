import PageContainer from '@/components/layout/page-container';
import LocationImport from '@/features/locations/components/location-import';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Impor lokasi' };

export default async function Page() {
  await requireAdmin();
  return (
    <PageContainer>
      <div className='flex-1 space-y-4'>
        <LocationImport />
      </div>
    </PageContainer>
  );
}
