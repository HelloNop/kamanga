'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Pill } from '@/components/ui/pill';
import { listingFormOptions } from '@/features/listings/api/queries';
import { VERIFICATION_LABELS } from '@/features/listings/constants/listing-options';
import { formatRupiah } from '@/features/listings/lib/format';
import type { ProviderCard } from '@/lib/directory/providers';
import { formatClock, formatDay, jakartaDate } from '@/lib/engines/time';
import { useAppForm } from '@/lib/form';
import { runProviderSearch } from '../api/service';
import type { ProviderSearchInput, ProviderSearchResponse } from '../api/types';

// Sinyal skor PRD 8.3 (bobot di src/lib/directory/ranking.ts).
const SIGNAL_LABEL: Record<string, string> = {
  relevance: 'Relevansi',
  location: 'Lokasi',
  availability: 'Ketersediaan',
  verification: 'Verifikasi',
  reviews: 'Ulasan',
  completeness: 'Kelengkapan'
};
const MODE_LABEL = { visit: 'didatangi warga', call: 'datang ke warga', online: 'daring' };

const optionalNumber = z.number().positive('Harus lebih dari 0').optional();
const schema = z.object({
  categoryId: z.string().min(1, 'Pilih kategori'),
  place: z.string().max(100),
  date: z.string(),
  from: z.string(),
  to: z.string(),
  seats: optionalNumber,
  prefer: z.string(),
  radiusKm: optionalNumber,
  budgetMax: optionalNumber,
  sort: z.string(),
  includePlaces: z.boolean()
});
type Values = z.infer<typeof schema>;

const toInput = (v: Values): ProviderSearchInput => ({
  categoryId: Number(v.categoryId),
  place: v.place.trim() || undefined,
  date: v.date || undefined,
  from: v.date && v.from ? v.from : undefined,
  to: v.date && v.to ? v.to : undefined,
  seats: v.seats,
  prefer: v.prefer === 'call' ? 'call' : v.prefer === 'visit' ? 'visit' : undefined,
  radiusKm: v.radiusKm,
  budgetMax: v.budgetMax,
  sort: v.sort === 'distance' ? 'distance' : 'score',
  includePlaces: v.includePlaces
});

function slotText(c: ProviderCard) {
  if (!c.slots.length) return null;
  const first = new Date(c.slots[0].startsAt);
  const times = c.slots.slice(0, 5).map((s) => formatClock(new Date(s.startsAt)));
  return `${formatDay(first)}: ${times.join(', ')}${c.slots.length > 5 ? ', …' : ''}`;
}

function ProviderResultCard({ c, rank }: { c: ProviderCard; rank?: number }) {
  const parts = Object.entries(c.parts);
  const slots = slotText(c);
  return (
    <Card size='sm'>
      <CardContent className='space-y-3'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              {rank && <span className='text-muted-foreground text-sm'>#{rank}</span>}
              <span className='font-semibold'>{c.name}</span>
              <Badge variant='outline'>{c.category.name}</Badge>
              {c.kind === 'place' && <Badge variant='secondary'>Tempat</Badge>}
              <Pill tone={c.bookable ? 'ok' : 'mut'}>
                {c.bookable ? 'Bisa dipesan' : 'Belum bisa dipesan'}
              </Pill>
            </div>
            <p className='text-muted-foreground text-sm'>
              {[
                c.place,
                c.distanceLabel,
                MODE_LABEL[c.mode],
                VERIFICATION_LABELS[c.verification as keyof typeof VERIFICATION_LABELS],
                c.price.min !== null && `mulai ${formatRupiah(c.price.min)}`,
                c.rating && `${c.rating.satisfied}/${c.rating.count} puas`
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {slots && <p className='text-sm'>Slot kosong {slots}</p>}
            {c.missing.length > 0 && (
              <p className='text-sm text-amber-700 dark:text-amber-300'>
                Data kosong: {c.missing.join(', ')}
              </p>
            )}
          </div>
          <div className='shrink-0 text-right'>
            <div className='text-2xl font-bold tabular-nums'>{(c.score * 100).toFixed(0)}</div>
            <div className='text-muted-foreground text-xs'>skor</div>
          </div>
        </div>
        <div className='space-y-2 text-sm'>
          <div
            className='flex h-3 overflow-hidden rounded'
            role='img'
            aria-label='Kontribusi tiap sinyal terhadap skor'
          >
            {parts.map(([k, p]) => (
              <div
                key={k}
                title={`${SIGNAL_LABEL[k] ?? k}: ${p!.value.toFixed(2)} × ${(p!.weight * 100).toFixed(0)}%`}
                style={{ width: `${p!.weight * p!.value * 100}%` }}
                className='bg-primary/70 border-background border-r last:border-0'
              />
            ))}
          </div>
          <ul className='text-muted-foreground grid gap-x-6 sm:grid-cols-3'>
            {parts.map(([k, p]) => (
              <li key={k} className='flex justify-between gap-2'>
                <span>{SIGNAL_LABEL[k] ?? k}</span>
                <span className='tabular-nums'>
                  {p!.value.toFixed(2)} × {(p!.weight * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/** Uji pencarian mode Pintu: memanggil findProviders persis seperti halaman pintu dan chat. */
export function ProviderConsole() {
  const { data: options } = useSuspenseQuery(listingFormOptions());
  const [last, setLast] = useState<ProviderSearchInput | null>(null);
  const [res, setRes] = useState<ProviderSearchResponse | null>(null);
  const search = useMutation({ mutationFn: (i: ProviderSearchInput) => runProviderSearch(i) });

  const go = (i: ProviderSearchInput) => {
    setLast(i);
    search.mutate(i, {
      onSuccess: setRes,
      onError: () => toast.error('Pencarian gagal. Periksa isian Anda.')
    });
  };

  const form = useAppForm({
    defaultValues: {
      categoryId: '',
      place: '',
      date: jakartaDate(new Date()),
      from: '',
      to: '',
      seats: undefined,
      prefer: '',
      radiusKm: 15,
      budgetMax: undefined,
      sort: 'score',
      includePlaces: false
    } as Values,
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => go(toInput(value))
  });

  const r = res?.result;
  return (
    <div className='w-full max-w-5xl space-y-4 pb-8'>
      <Card size='sm'>
        <CardHeader>
          <CardTitle>Pencarian pintu</CardTitle>
          <CardDescription>
            Sama dengan daftar penyedia di halaman pintu dan chat: syarat wajib (kategori, wilayah,
            slot kosong, anggaran) menyaring, lalu skor mengurutkan. Data kosong pada syarat wajib
            masuk &ldquo;belum pasti&rdquo;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <div className='grid gap-4 md:grid-cols-2'>
              <form.AppField
                name='categoryId'
                children={(f) => (
                  <f.ComboboxField
                    label='Kategori'
                    required
                    options={options.categories.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                      description: c.group ?? undefined
                    }))}
                    placeholder='Pilih kategori'
                    searchPlaceholder='Cari kategori...'
                  />
                )}
              />
              <form.AppField
                name='place'
                children={(f) => (
                  <f.TextField label='Wilayah' placeholder='mis. Lubeg, Kuranji, Koto Baru' />
                )}
              />
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <form.AppField
                name='date'
                children={(f) => (
                  <f.TextField
                    label='Tanggal'
                    type='date'
                    description='Kosong = tanpa syarat waktu'
                  />
                )}
              />
              <form.AppField
                name='from'
                children={(f) => <f.TextField label='Dari jam' type='time' />}
              />
              <form.AppField
                name='to'
                children={(f) => <f.TextField label='Sampai jam' type='time' />}
              />
            </div>
            <details>
              <summary className='text-muted-foreground cursor-pointer text-sm'>
                Syarat tambahan
              </summary>
              <div className='mt-3 grid gap-4 sm:grid-cols-3'>
                <form.AppField
                  name='seats'
                  children={(f) => (
                    <f.TextField label='Jumlah orang / kursi' type='number' min={1} />
                  )}
                />
                <form.AppField
                  name='radiusKm'
                  children={(f) => (
                    <f.TextField label='Radius (km)' type='number' min={1} max={100} />
                  )}
                />
                <form.AppField
                  name='budgetMax'
                  children={(f) => (
                    <f.TextField label='Anggaran maksimal (Rp)' type='number' min={0} />
                  )}
                />
                <form.AppField
                  name='prefer'
                  children={(f) => (
                    <f.SelectField
                      label='Cara layanan'
                      options={[
                        { value: '', label: '(otomatis)' },
                        { value: 'visit', label: 'Warga datang' },
                        { value: 'call', label: 'Penyedia datang' }
                      ]}
                    />
                  )}
                />
                <form.AppField
                  name='sort'
                  children={(f) => (
                    <f.SelectField
                      label='Urutan'
                      options={[
                        { value: 'score', label: 'Skor gabungan' },
                        { value: 'distance', label: 'Terdekat dulu' }
                      ]}
                    />
                  )}
                />
                <form.AppField
                  name='includePlaces'
                  children={(f) => <f.SwitchField label='Ikut Tempat (informasi saja)' />}
                />
              </div>
            </details>
            <form.AppForm>
              <form.SubmitButton disabled={search.isPending}>
                {search.isPending ? 'Mencari...' : 'Cari penyedia'}
              </form.SubmitButton>
            </form.AppForm>
          </form>
        </CardContent>
      </Card>

      {res?.region && (
        <p className='text-sm'>
          Wilayah:{' '}
          <Badge variant='secondary'>
            {res.region.name}
            {res.region.parentName ? `, ${res.region.parentName}` : ''}
          </Badge>
        </p>
      )}
      {res?.note && (
        <Card size='sm'>
          <CardContent className='space-y-2 text-sm'>
            <p>{res.note}</p>
            {res.options.length > 0 && last && (
              <div className='flex flex-wrap gap-2'>
                {res.options.map((o) => (
                  <Button
                    key={o.id}
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => go({ ...last, regionId: o.id })}
                  >
                    {o.name}
                    {o.parentName ? ` (${o.parentName})` : ''}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {r && (
        <div className='space-y-3'>
          <p className='text-sm'>
            <strong>{r.total}</strong> penyedia lolos syarat wajib
            {r.total > r.items.length ? `, menampilkan ${r.items.length} teratas` : ''}.
          </p>
          {r.items.map((c, i) => (
            <ProviderResultCard key={c.id} c={c} rank={i + 1} />
          ))}
          {r.relaxations.length > 0 && (
            <Card size='sm'>
              <CardHeader>
                <CardTitle className='text-base'>Pelonggaran yang ditawarkan ke warga</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='list-disc space-y-1 pl-5 text-sm'>
                  {r.relaxations.map((x) => (
                    <li key={x.key}>
                      {x.label} <span className='text-muted-foreground'>→ {x.count} penyedia</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {r.uncertain.length > 0 && (
            <>
              <h3 className='pt-2 font-semibold'>Belum pasti (data syarat wajib kosong)</h3>
              {r.uncertain.map((c) => (
                <ProviderResultCard key={c.id} c={c} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
