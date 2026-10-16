'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { sendViaWa } from '@/features/bookings/lib/wa-window';
import { unansweredQuestionsOptions } from '../api/queries';
import { forwardQuestion } from '../api/service';

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

/** Pertanyaan warga yang belum ada jawabannya; tim meneruskannya ke penyedia lewat WA. */
export function UnansweredQuestions() {
  const { data } = useSuspenseQuery(unansweredQuestionsOptions());
  const forward = useMutation({
    mutationFn: async (id: number) => {
      const r = await forwardQuestion(id);
      if (!r.ok) throw new Error(r.message);
      return r.notice;
    }
  });

  return (
    <section className='bg-card rounded-2xl p-5 shadow-sm'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <h3 className='text-[1.0625rem] font-semibold'>Pertanyaan warga belum terjawab</h3>
        <span className='text-muted-foreground text-xs'>
          {data.length} pertanyaan · terlama di atas
        </span>
      </div>
      {data.length === 0 ? (
        <p className='text-muted-foreground mt-3 text-sm'>Semua pertanyaan warga sudah dijawab.</p>
      ) : (
        <ul className='mt-3 divide-y'>
          {data.map((q) => (
            <li key={q.id} className='flex flex-wrap items-center gap-3 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium'>&ldquo;{q.question}&rdquo;</p>
                <p className='text-muted-foreground mt-0.5 text-xs'>
                  <Link
                    href={`/dashboard/listings/${q.listing.id}`}
                    className='underline-offset-4 hover:underline'
                  >
                    {q.listing.name}
                  </Link>
                  {[q.category, q.place, dateFmt.format(new Date(q.createdAt))]
                    .filter(Boolean)
                    .map((t) => ` · ${t}`)
                    .join('')}
                </p>
              </div>
              {q.listing.whatsapp ? (
                <Button
                  type='button'
                  size='sm'
                  disabled={forward.isPending}
                  onClick={() => sendViaWa(() => forward.mutateAsync(q.id))}
                  className='h-10 bg-emerald-600 text-white hover:bg-emerald-700'
                >
                  <Icons.whatsapp className='mr-1.5 size-4' /> Teruskan ke penyedia
                </Button>
              ) : (
                <Pill tone='bad'>Penyedia tanpa WhatsApp</Pill>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
