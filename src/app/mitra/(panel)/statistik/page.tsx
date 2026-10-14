import PageContainer from '@/components/layout/page-container';
import { mitraContext } from '@/features/mitra/api/context';
import { getStats } from '@/features/mitra/api/service';
import { Empty, NoListing, Panel } from '@/features/mitra/components/bits';

export const metadata = { title: 'Statistik' };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className='bg-muted/60 rounded-xl p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-0.5 text-2xl font-semibold'>{value}</div>
      {hint && <div className='text-muted-foreground text-xs'>{hint}</div>}
    </div>
  );
}

const hourText = (h: number) =>
  `${String(h).padStart(2, '0')}.00–${String((h + 1) % 24).padStart(2, '0')}.00`;

export default async function StatsPage() {
  const { active } = await mitraContext();
  if (!active)
    return (
      <PageContainer pageTitle='Statistik'>
        <NoListing />
      </PageContainer>
    );
  const s = await getStats(active.id);
  const rate = s.answered ? `${Math.round((s.accepted / s.answered) * 100)}%` : '-';
  return (
    <PageContainer pageTitle='Statistik' pageDescription={`${s.days} hari terakhir.`}>
      <div className='space-y-3'>
        <Panel>
          <div className='grid grid-cols-2 gap-2'>
            <Stat label='Dilihat warga' value={s.views} />
            <Stat label='Dipesan' value={s.booked} />
            <Stat label='Diterima' value={s.accepted} />
            <Stat
              label='Persentase diterima'
              value={rate}
              hint='dari pesanan yang sudah dijawab atau lewat batas waktu'
            />
          </div>
        </Panel>
        <Panel title='Jam paling ramai'>
          {s.peakHours.length ? (
            <ol className='space-y-1.5 text-sm'>
              {s.peakHours.map((h, i) => (
                <li key={h.hour} className='flex justify-between gap-2'>
                  <span>
                    {i + 1}. {hourText(h.hour)}
                  </span>
                  <span className='text-muted-foreground'>{h.count} pesanan</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Belum cukup pesanan dalam 90 hari terakhir.</Empty>
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}
