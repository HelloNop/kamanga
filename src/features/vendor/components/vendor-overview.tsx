'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { vendorSummaryOptions } from '../api/queries';

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className='bg-card rounded-xl p-5 shadow-sm'>
      <div className='text-muted-foreground text-sm'>{label}</div>
      <div className={cn('mt-1 text-4xl font-light tracking-tight', tone)}>{value}</div>
    </div>
  );
}

export function VendorOverview() {
  const { data: s } = useSuspenseQuery(vendorSummaryOptions());

  if (s.total === 0)
    return (
      <div className='bg-card rounded-xl p-6 shadow-sm'>
        <h3 className='text-[1.0625rem] font-semibold'>Mulai dengan mendaftarkan usaha Anda</h3>
        <ol className='text-muted-foreground mt-3 list-inside list-decimal space-y-1.5 text-sm'>
          <li>Isi data usaha: nama, kategori, lokasi, dan kontak.</li>
          <li>Kirim untuk review. Tim Kamanga memeriksa sebelum listing tampil.</li>
          <li>Setelah disetujui, warga menemukan usaha Anda lewat chat Kamanga.</li>
        </ol>
        <Link
          href='/dashboard/my-listings/new'
          className={cn(buttonVariants(), 'mt-5 inline-flex')}
        >
          <Icons.add className='mr-2 size-4' /> Tambah listing
        </Link>
      </div>
    );

  return (
    <div className='space-y-3.5'>
      {s.rejected > 0 && (
        <Link
          href='/dashboard/my-listings'
          className='block rounded-2xl bg-red-500/10 px-4 py-3.5 text-[0.9375rem]'
        >
          <b>{s.rejected} listing ditolak.</b> Lihat alasannya dan perbaiki.
        </Link>
      )}
      <div className='grid grid-cols-2 gap-3.5 lg:grid-cols-4'>
        <Stat
          label='Tampil ke warga'
          value={s.published}
          tone='text-emerald-700 dark:text-emerald-300'
        />
        <Stat label='Menunggu review' value={s.pending} />
        <Stat label='Draf' value={s.draft} />
        <Stat label='Ditolak' value={s.rejected} />
      </div>
      <Link
        href='/dashboard/my-listings'
        className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')}
      >
        Kelola listing saya
      </Link>
    </div>
  );
}
