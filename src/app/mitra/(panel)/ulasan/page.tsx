import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { getReviews } from '@/features/mitra/api/service';
import { Empty, NoListing, Panel } from '@/features/mitra/components/bits';

export const metadata = { title: 'Ulasan' };

const dateFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export default async function ReviewsPage() {
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Ulasan'>
        <NoListing />
      </PageContainer>
    );
  const r = await getReviews(active.id);
  return (
    <PageContainer pageTitle='Ulasan' pageDescription='Dari pesanan yang sudah selesai.'>
      <div className='space-y-3'>
        <Panel>
          <div className='grid grid-cols-3 gap-2 text-center'>
            <div>
              <div className='text-2xl font-semibold'>{r.total}</div>
              <div className='text-muted-foreground text-xs'>ulasan</div>
            </div>
            <div>
              <div className='text-2xl font-semibold'>
                {r.total ? Math.round((r.satisfied / r.total) * 100) : 0}%
              </div>
              <div className='text-muted-foreground text-xs'>puas</div>
            </div>
            <div>
              <div className='text-2xl font-semibold'>{r.avgStars ?? '-'}</div>
              <div className='text-muted-foreground text-xs'>rata-rata bintang</div>
            </div>
          </div>
        </Panel>
        {r.items.length ? (
          <ul className='space-y-2'>
            {r.items.map((v) => (
              <li key={v.id} className='bg-card rounded-xl p-4 shadow-sm'>
                <div className='flex items-center gap-2 text-sm font-semibold'>
                  {v.satisfied ? (
                    <Icons.thumbUp
                      className='size-5 text-emerald-700 dark:text-emerald-300'
                      aria-hidden
                    />
                  ) : (
                    <Icons.thumbDown
                      className='size-5 text-red-700 dark:text-red-300'
                      aria-hidden
                    />
                  )}
                  {v.satisfied ? 'Puas' : 'Kurang puas'}
                  {v.stars && (
                    <span className='text-muted-foreground font-normal'>
                      · {v.stars} dari 5 bintang
                    </span>
                  )}
                </div>
                {v.comment && <p className='mt-1.5 text-sm'>{v.comment}</p>}
                <p className='text-muted-foreground mt-1.5 text-xs'>
                  {[v.item, dateFmt.format(v.createdAt)].filter(Boolean).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Belum ada ulasan. Ulasan masuk setelah pesanan ditandai selesai.</Empty>
        )}
      </div>
    </PageContainer>
  );
}
