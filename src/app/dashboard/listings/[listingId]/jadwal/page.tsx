import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { getListingById } from '@/features/listings/api/service';
import { ListingTabs } from '@/features/listings/components/listing-tabs';
import { ScheduleEditor } from '@/features/mitra/components/schedule-editor';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Jadwal listing' };

export default async function Page(props: { params: Promise<{ listingId: string }> }) {
  await requireAdmin();
  const { listingId } = await props.params;
  if (!/^\d+$/.test(listingId)) notFound();
  const listing = await getListingById(Number(listingId));
  if (!listing) notFound();

  return (
    <PageContainer
      pageTitle={`Jadwal: ${listing.values.name}`}
      pageDescription='Unit, jam buka, libur, dan blokir slot. Sama dengan yang dilihat mitra di dashboard mitra.'
    >
      <ListingTabs listingId={listing.id} />
      <ScheduleEditor listingId={listing.id} />
    </PageContainer>
  );
}
