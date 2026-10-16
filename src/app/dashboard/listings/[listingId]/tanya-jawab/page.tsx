import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { getListingById } from '@/features/listings/api/service';
import { ListingTabs } from '@/features/listings/components/listing-tabs';
import { QaEditor } from '@/features/mitra/components/qa-editor';
import { requireAdmin } from '@/lib/session';

export const metadata = { title: 'Tanya jawab listing' };

export default async function Page(props: { params: Promise<{ listingId: string }> }) {
  await requireAdmin();
  const { listingId } = await props.params;
  if (!/^\d+$/.test(listingId)) notFound();
  const listing = await getListingById(Number(listingId));
  if (!listing) notFound();

  return (
    <PageContainer
      pageTitle={`Tanya jawab: ${listing.values.name}`}
      pageDescription='Pertanyaan dan jawaban penyedia. Chat hanya menjawab dari data ini dan isian aturan kategori.'
    >
      <ListingTabs listingId={listing.id} />
      <QaEditor listingId={listing.id} />
    </PageContainer>
  );
}
