'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Tab halaman satu listing di panel admin: data, jadwal (Mesin Jadwal), tanya jawab penyedia. */
export function ListingTabs({ listingId }: { listingId: number }) {
  const pathname = usePathname();
  const base = `/dashboard/listings/${listingId}`;
  const tabs = [
    { href: base, label: 'Data usaha' },
    { href: `${base}/jadwal`, label: 'Jadwal' },
    { href: `${base}/tanya-jawab`, label: 'Tanya jawab' }
  ];
  return (
    <nav
      aria-label='Bagian listing'
      className='bg-card mb-4 inline-flex rounded-xl p-[3px] shadow-sm'
    >
      {tabs.map((t) => {
        const on = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex h-9 items-center rounded-[9px] px-4 text-sm transition-colors',
              on
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground font-medium hover:text-foreground'
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
