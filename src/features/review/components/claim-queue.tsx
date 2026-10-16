'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { decideClaimMutation } from '../api/mutations';
import { claimQueueOptions } from '../api/queries';
import type { PendingClaim } from '@/features/mitra/api/claims';

const local = (wa: string) => `0${wa.replace(/^62/, '')}`;

function ClaimCard({ c }: { c: PendingClaim }) {
  const decide = useMutation(decideClaimMutation);
  const run = (decision: 'approve' | 'reject') =>
    decide.mutate(
      { id: c.id, decision },
      {
        onSuccess: () =>
          toast.success(
            decision === 'approve'
              ? 'Klaim disetujui. Usaha pindah ke akun mitra.'
              : 'Klaim ditolak'
          ),
        onError: (e) => toast.error(e.message)
      }
    );
  return (
    <article className='bg-card rounded-xl p-5 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <h3 className='text-[1.0625rem] font-semibold'>
          <Link href={`/dashboard/listings/${c.listingId}`} className='hover:underline'>
            {c.listingName.replace('[DUMMY] ', '')}
          </Link>
        </h3>
        <span className='rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300'>
          Klaim usaha
        </span>
      </div>
      <p className='text-muted-foreground mt-1 text-sm'>
        Diklaim oleh <b className='text-foreground'>{c.claimant.name}</b> ({c.claimant.email})
      </p>
      <p className='mt-2 text-sm'>
        Pastikan ke nomor usaha bahwa akun ini memang milik pemiliknya:{' '}
        {c.whatsapp ? (
          <a
            href={`https://wa.me/${c.whatsapp}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary font-semibold underline underline-offset-4'
          >
            WA {local(c.whatsapp)}
          </a>
        ) : (
          (c.phone ?? <span className='text-muted-foreground'>usaha tanpa kontak</span>)
        )}
      </p>
      <div className='mt-4 flex flex-wrap gap-2 border-t pt-4'>
        <Button type='button' disabled={decide.isPending} onClick={() => run('approve')}>
          <Icons.circleCheck className='mr-1.5 size-4' /> Setujui klaim
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={decide.isPending}
          onClick={() => run('reject')}
        >
          Tolak
        </Button>
      </div>
    </article>
  );
}

/** Klaim usaha yang menunggu (kode WA tidak dipakai atau usaha tanpa WA). Kosong = tidak tampil. */
export function ClaimQueue() {
  const { data } = useSuspenseQuery(claimQueueOptions());
  if (!data.length) return null;
  return (
    <section className='mb-6'>
      <h2 className='mb-3 text-lg font-semibold'>Klaim usaha ({data.length})</h2>
      <div className='space-y-3.5'>
        {data.map((c) => (
          <ClaimCard key={c.id} c={c} />
        ))}
      </div>
    </section>
  );
}
