'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { setActiveListing } from '../api/service';
import type { OwnedListing } from '../api/types';

const MORE = ['/mitra/lainnya', '/mitra/usaha', '/mitra/ulasan', '/mitra/statistik'];

/** Navigasi bawah (ramah jempol). Jadwal hanya untuk kategori ber-jadwal slot/seat. */
export function MitraNav({ showSchedule, waiting }: { showSchedule: boolean; waiting: number }) {
  const path = usePathname();
  const items = [
    { href: '/mitra', label: 'Beranda', icon: Icons.home, on: path === '/mitra' },
    {
      href: '/mitra/pesanan',
      label: 'Pesanan',
      icon: Icons.receipt,
      on: path.startsWith('/mitra/pesanan'),
      badge: waiting
    },
    ...(showSchedule
      ? [
          {
            href: '/mitra/jadwal',
            label: 'Jadwal',
            icon: Icons.calendar,
            on: path.startsWith('/mitra/jadwal')
          }
        ]
      : []),
    {
      href: '/mitra/tanya-jawab',
      label: 'Tanya jawab',
      icon: Icons.messageQuestion,
      on: path.startsWith('/mitra/tanya-jawab')
    },
    {
      href: '/mitra/lainnya',
      label: 'Lainnya',
      icon: Icons.dots,
      on: MORE.some((m) => path.startsWith(m))
    }
  ];
  return (
    <nav
      aria-label='Menu mitra'
      className='bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_-12px_rgb(0_0_0/0.25)]'
    >
      <ul className='mx-auto flex max-w-2xl'>
        {items.map((it) => (
          <li key={it.href} className='min-w-0 flex-1'>
            <Link
              href={it.href}
              aria-current={it.on ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring/50 relative flex min-h-[60px] flex-col items-center justify-center gap-0.5 px-1 text-[0.72rem] font-semibold outline-none focus-visible:ring-2',
                it.on ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <it.icon className='size-6' aria-hidden />
              <span className='max-w-full truncate'>{it.label}</span>
              {!!it.badge && (
                <span className='absolute top-1.5 left-1/2 ml-2 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[0.68rem] leading-5 text-white'>
                  {it.badge > 99 ? '99+' : it.badge}
                  <span className='sr-only'> pesanan menunggu jawaban</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Pemilih usaha bila mitra punya lebih dari satu. Pilihan disimpan di cookie (server action). */
export function ListingSwitcher({
  listings,
  activeId
}: {
  listings: OwnedListing[];
  activeId: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (listings.length < 2)
    return (
      <p className='truncate text-[0.9375rem] font-bold'>
        {listings.find((l) => l.id === activeId)?.name}
      </p>
    );
  return (
    <>
      <label htmlFor='usaha-aktif' className='sr-only'>
        Usaha yang dikelola
      </label>
      <select
        id='usaha-aktif'
        value={activeId}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            try {
              await setActiveListing(Number(e.target.value));
              router.refresh();
            } catch {
              toast.error('Gagal mengganti usaha');
            }
          })
        }
        className='bg-card focus-visible:ring-ring/50 h-11 w-full min-w-0 truncate rounded-xl border px-3 text-[0.9375rem] font-bold outline-none focus-visible:ring-3'
      >
        {listings.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </>
  );
}
