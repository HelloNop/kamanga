import Link from 'next/link';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { mitraContext } from '@/features/mitra/api/context';
import { Panel } from '@/features/mitra/components/bits';

export const metadata = { title: 'Lainnya' };

const ITEMS = [
  {
    href: '/mitra/usaha',
    icon: Icons.buildingStore,
    label: 'Usaha & layanan',
    hint: 'Profil, foto, harga, area, kontak, aturan'
  },
  { href: '/mitra/ulasan', icon: Icons.star, label: 'Ulasan', hint: 'Dari pesanan selesai' },
  {
    href: '/mitra/statistik',
    icon: Icons.chartBar,
    label: 'Statistik',
    hint: 'Dilihat, dipesan, jam paling ramai'
  }
];

export default async function MorePage() {
  const { active } = await mitraContext();
  return (
    <PageContainer pageTitle='Lainnya'>
      <div className='space-y-3'>
        <nav aria-label='Menu lainnya' className='bg-card rounded-xl p-2 shadow-sm'>
          <ul>
            {ITEMS.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className='hover:bg-muted flex min-h-14 items-center gap-3 rounded-lg px-2'
                >
                  <it.icon className='text-primary size-6 shrink-0' aria-hidden />
                  <span className='min-w-0 flex-1'>
                    <span className='block font-semibold'>{it.label}</span>
                    <span className='text-muted-foreground block text-xs'>{it.hint}</span>
                  </span>
                  <Icons.chevronRight className='text-muted-foreground size-4' aria-hidden />
                </Link>
              </li>
            ))}
            {active?.status === 'published' && (
              <li>
                <Link
                  href={`/listing/${active.slug}`}
                  target='_blank'
                  className='hover:bg-muted flex min-h-14 items-center gap-3 rounded-lg px-2'
                >
                  <Icons.externalLink className='text-primary size-6 shrink-0' aria-hidden />
                  <span className='flex-1 font-semibold'>Lihat halaman usaha</span>
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <Panel>
          <div className='flex items-center justify-between gap-2'>
            <span className='text-sm font-semibold'>Tampilan terang / gelap</span>
            <ThemeModeToggle />
          </div>
        </Panel>
        <p className='text-muted-foreground px-1 text-xs'>
          Pasang Kamanga Mitra di layar utama ponsel: buka menu browser lalu pilih &ldquo;Tambahkan
          ke layar utama&rdquo;.
        </p>
      </div>
    </PageContainer>
  );
}
