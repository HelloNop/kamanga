import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { getMissingRules } from '@/features/mitra/api/service';
import { NoListing, Panel } from '@/features/mitra/components/bits';
import { QaEditor } from '@/features/mitra/components/qa-editor';

export const metadata = { title: 'Aturan & tanya jawab' };

export default async function QaPage() {
  // mitraContext() memanggil requireVendor(); active selalu usaha milik mitra ini.
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Aturan & tanya jawab'>
        <NoListing />
      </PageContainer>
    );
  const missing = await getMissingRules(active.id);
  return (
    <PageContainer
      pageTitle='Aturan & tanya jawab'
      pageDescription='Jawaban di sini dipakai Kamanga saat warga bertanya tentang usaha Anda.'
    >
      <div className='space-y-4'>
        <Panel title='Isian aturan kategori'>
          <p className='text-muted-foreground text-sm'>
            {missing.length
              ? `Belum diisi: ${missing.join(', ')}. Aturan seperti durasi minimal, batas pembatalan, dan DP ditampilkan ke warga sebelum memesan.`
              : 'Semua isian aturan sudah terisi.'}
          </p>
          <Link
            href={`/mitra/usaha/${active.id}`}
            className='text-primary mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold'
          >
            {missing.length ? 'Lengkapi isian aturan' : 'Ubah isian aturan'}
            <Icons.chevronRight className='size-4' aria-hidden />
          </Link>
        </Panel>
        <QaEditor listingId={active.id} />
      </div>
    </PageContainer>
  );
}
