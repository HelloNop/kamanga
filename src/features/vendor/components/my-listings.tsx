'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { buttonVariants } from '@/components/ui/button';
import { InitialAvatar } from '@/components/ui/initial-avatar';
import { Pill, type PillTone } from '@/components/ui/pill';
import { STATUS_LABELS, type ListingStatus } from '@/features/listings/constants/listing-options';
import { cn } from '@/lib/utils';
import { archiveMyListingMutation } from '../api/mutations';
import { myListingsOptions } from '../api/queries';
import type { MyListing } from '../api/types';

const TONE: Record<ListingStatus, PillTone> = {
  published: 'ok',
  pending_review: 'warn',
  draft: 'mut',
  rejected: 'bad',
  archived: 'mut'
};

// Penjelasan singkat di bawah nama, sesuai status.
const HINT: Record<ListingStatus, string> = {
  published: 'Tampil ke warga dan chatbot.',
  pending_review: 'Sedang diperiksa tim Kamanga.',
  draft: 'Belum dikirim. Lengkapi lalu kirim untuk review.',
  rejected: 'Perlu diperbaiki, lalu kirim ulang.',
  archived: 'Disembunyikan dari warga.'
};

function Row({ item, onArchive }: { item: MyListing; onArchive: () => void }) {
  const canSubmit =
    item.status === 'draft' || item.status === 'rejected' || item.status === 'archived';
  return (
    <article className='bg-card rounded-xl p-5 shadow-sm'>
      <div className='flex items-start gap-3.5'>
        <InitialAvatar name={item.name} seed={item.categoryName} />
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-x-2.5 gap-y-1'>
            <h3 className='truncate text-[1.0625rem] font-semibold'>{item.name}</h3>
            <Pill tone={TONE[item.status]}>{STATUS_LABELS[item.status]}</Pill>
          </div>
          <p className='text-muted-foreground mt-0.5 text-sm'>
            {[
              item.categoryName ?? 'Tanpa kategori',
              item.locationName ?? 'Lokasi belum dipilih'
            ].join(' · ')}
          </p>
          <p className='text-muted-foreground mt-1 text-[0.8125rem]'>{HINT[item.status]}</p>
        </div>
        <div className='hidden shrink-0 text-right sm:block'>
          <div
            className={cn(
              'text-sm font-semibold',
              item.completeness < 60 && 'text-amber-700 dark:text-amber-300'
            )}
          >
            {item.completeness}%
          </div>
          <div className='text-muted-foreground text-xs'>lengkap</div>
        </div>
      </div>

      {item.reviewNote && (
        <p role='alert' className='mt-3.5 rounded-xl bg-red-500/10 px-3.5 py-2.5 text-sm'>
          <b>Alasan penolakan:</b> {item.reviewNote}
        </p>
      )}
      {item.missing.length > 0 && item.status !== 'archived' && (
        <p className='text-muted-foreground mt-3 text-xs'>
          Belum diisi: {item.missing.join(', ')}. Listing yang lengkap lebih mudah ditemukan.
        </p>
      )}

      <div className='mt-4 flex flex-wrap items-center gap-2 border-t pt-4'>
        <Link
          href={`/dashboard/my-listings/${item.id}`}
          className={buttonVariants({ variant: canSubmit ? 'default' : 'outline', size: 'sm' })}
        >
          {canSubmit
            ? item.status === 'rejected'
              ? 'Perbaiki dan kirim ulang'
              : 'Lengkapi dan kirim'
            : 'Ubah'}
        </Link>
        {item.status === 'published' && (
          <Link
            href={`/listing/${item.slug}`}
            target='_blank'
            className='text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline'
          >
            Lihat halaman publik
          </Link>
        )}
        {item.status !== 'archived' && (
          <button
            type='button'
            onClick={onArchive}
            className='text-muted-foreground hover:text-foreground ml-auto text-sm underline-offset-4 hover:underline'
          >
            Sembunyikan dari warga
          </button>
        )}
      </div>
    </article>
  );
}

export function MyListings() {
  const { data } = useSuspenseQuery(myListingsOptions());
  const [archiving, setArchiving] = useState<MyListing | null>(null);
  const archive = useMutation(archiveMyListingMutation);

  if (data.length === 0)
    return (
      <div className='bg-card grid min-h-64 place-items-center rounded-xl p-8 text-center shadow-sm'>
        <div className='max-w-sm'>
          <Icons.workspace className='text-muted-foreground mx-auto mb-3 size-8' />
          <p className='font-medium'>Belum ada listing</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            Daftarkan usaha Anda supaya warga Sumatera Barat bisa menemukannya lewat Kamanga.
          </p>
          <Link
            href='/dashboard/my-listings/new'
            className={cn(buttonVariants(), 'mt-4 inline-flex')}
          >
            <Icons.add className='mr-2 size-4' /> Tambah listing
          </Link>
        </div>
      </div>
    );

  return (
    <>
      <div className='space-y-3.5'>
        {data.map((item) => (
          <Row key={item.id} item={item} onArchive={() => setArchiving(item)} />
        ))}
      </div>
      <AlertModal
        isOpen={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={() =>
          archiving &&
          archive.mutate(archiving.id, {
            onSuccess: () => {
              toast.success('Listing disembunyikan');
              setArchiving(null);
            },
            onError: (e) => toast.error(e.message)
          })
        }
        loading={archive.isPending}
        title='Sembunyikan listing ini?'
        description='Listing tidak lagi tampil ke warga dan chatbot. Anda bisa mengirimnya lagi untuk review kapan saja.'
        confirmLabel='Sembunyikan'
      />
    </>
  );
}
