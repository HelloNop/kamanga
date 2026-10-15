import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill, type PillTone } from '@/components/ui/pill';
import { getClaimPage } from '@/features/mitra/api/service';
import { Empty, Panel } from '@/features/mitra/components/bits';
import { ClaimButton, ClaimVerify } from '@/features/mitra/components/claim-actions';

export const metadata = { title: 'Klaim usaha' };

const STATUS: Record<'pending' | 'approved' | 'rejected', [string, PillTone]> = {
  pending: ['Menunggu verifikasi', 'warn'],
  approved: ['Disetujui', 'ok'],
  rejected: ['Ditolak', 'bad']
};

const clean = (name: string) => name.replace('[DUMMY] ', '');

// Klaim usaha yang diinput tim (PRD 8.12 langkah 1 dan 4). Gerbang: getClaimPage() → requireVendor().
export default async function ClaimPage(props: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await props.searchParams;
  const { mine, results } = await getClaimPage(q);
  const claimed = new Set(mine.filter((c) => c.status === 'pending').map((c) => c.listingId));

  return (
    <PageContainer
      pageTitle='Klaim usaha'
      pageDescription='Usaha Anda sudah ada di Kamanga karena diinput tim? Klaim supaya bisa mengelolanya sendiri.'
    >
      <div className='space-y-3'>
        {mine.length > 0 && (
          <Panel title='Klaim saya'>
            <ul className='divide-y'>
              {mine.map((c) => (
                <li key={c.id} className='py-3 first:pt-0 last:pb-0'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='min-w-0 font-semibold'>{clean(c.listingName)}</p>
                    <Pill tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</Pill>
                  </div>
                  {c.status === 'pending' &&
                    (c.waMasked ? (
                      <>
                        <p className='text-muted-foreground mt-1 text-sm'>
                          Kode dikirim ke WhatsApp usaha {c.waMasked}.
                        </p>
                        <ClaimVerify claimId={c.id} listingId={c.listingId} />
                      </>
                    ) : (
                      <p className='text-muted-foreground mt-1 text-sm'>
                        Usaha ini tidak punya nomor WhatsApp. Tim Kamanga akan memverifikasi klaim
                        Anda.
                      </p>
                    ))}
                  {c.status === 'rejected' && (
                    <p className='text-muted-foreground mt-1 text-sm'>
                      Bila usaha ini memang milik Anda, hubungi tim Kamanga.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title='Cari usaha Anda'>
          <form role='search' className='space-y-2'>
            <label htmlFor='klaim-q' className='text-sm font-medium'>
              Nama usaha
            </label>
            <div className='flex gap-2'>
              <Input
                id='klaim-q'
                name='q'
                defaultValue={q}
                minLength={2}
                maxLength={80}
                required
                placeholder='mis. Padel Kuranji'
                className='h-11'
              />
              <Button type='submit' className='h-11 shrink-0'>
                <Icons.search aria-hidden /> Cari
              </Button>
            </div>
          </form>
          {q.trim().length >= 2 && (
            <div className='mt-3'>
              {results.length ? (
                <ul className='divide-y'>
                  {results.map((l) => (
                    <li key={l.id} className='flex items-center gap-3 py-3'>
                      <div className='min-w-0 flex-1'>
                        <p className='font-semibold'>{clean(l.name)}</p>
                        <p className='text-muted-foreground text-sm'>
                          {[l.categoryName, l.district].filter(Boolean).join(' · ')}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {l.waMasked ? `WA ${l.waMasked}` : 'Tanpa nomor WhatsApp'}
                        </p>
                      </div>
                      {claimed.has(l.id) ? (
                        <Pill tone='warn'>Klaim Anda menunggu</Pill>
                      ) : (
                        <ClaimButton listingId={l.id} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>
                  Tidak ada usaha tanpa pemilik dengan nama itu. Belum ada di Kamanga? Daftarkan
                  dari menu Usaha &amp; layanan.
                </Empty>
              )}
            </div>
          )}
          <p className='text-muted-foreground mt-3 text-xs'>
            Kode verifikasi dikirim ke nomor WhatsApp yang terdaftar pada usaha. Nomor itu sudah
            berganti? Klaim tetap tercatat dan tim Kamanga yang memverifikasi.
          </p>
        </Panel>
      </div>
    </PageContainer>
  );
}
