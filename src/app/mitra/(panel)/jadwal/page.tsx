import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { NoListing } from '@/features/mitra/components/bits';
import { ScheduleEditor } from '@/features/mitra/components/schedule-editor';
import { timed } from '@/features/mitra/lib/format';

export const metadata = { title: 'Jadwal' };

export default async function SchedulePage() {
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Jadwal'>
        <NoListing />
      </PageContainer>
    );
  // Menu Jadwal hanya untuk kategori ber-jadwal slot/kursi.
  if (!timed(active.scheduleKind)) redirect('/mitra');
  return (
    <PageContainer
      pageTitle='Jadwal'
      pageDescription={
        active.scheduleKind === 'seat'
          ? 'Rute, jam berangkat, kursi, dan tanggal libur.'
          : 'Kalender, jam buka, harga, dan blokir jam yang sudah terisi.'
      }
    >
      <ScheduleEditor listingId={active.id} />
    </PageContainer>
  );
}
