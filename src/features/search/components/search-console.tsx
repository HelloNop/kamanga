'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { listingFormOptions } from '@/features/listings/api/queries';
import {
  PRICE_UNIT_LABELS,
  VERIFICATION_LABELS
} from '@/features/listings/constants/listing-options';
import type { SearchItem } from '@/lib/directory/search';
import { cn } from '@/lib/utils';
import { runSearch } from '../api/service';
import { ProviderConsole } from './provider-console';
import type { SearchInput, SearchResponse } from '../api/types';

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
const SIGNAL_LABEL: Record<string, string> = {
  relevance: 'Relevansi',
  geo: 'Lokasi',
  verification: 'Verifikasi',
  completeness: 'Kelengkapan',
  price: 'Harga'
};
const EXAMPLES: { label: string; input: SearchInput }[] = [
  { label: 'onda mogok di Lubeg', input: { q: 'onda mogok', locationText: 'Lubeg' } },
  {
    label: 'katering nasi kapau, Rp40.000 per orang',
    input: { q: 'katering nasi kapau', budget: 40000, budgetUnit: 'per_person' }
  },
  {
    label: 'gedung min. 400 orang di Padang',
    input: { q: 'gedung acara', locationText: 'Padang', minCapacity: 400 }
  },
  { label: 'cuci AC di Bukiktinggi', input: { q: 'cuci ac', locationText: 'Bukiktinggi' } },
  { label: 'jalan-jalan weekend', input: { q: 'mau jalan-jalan weekend' } },
  { label: 'koto baru (ambigu)', input: { q: 'servis ac', locationText: 'koto baru' } }
];

function priceText(i: SearchItem) {
  if (i.priceMin === null && i.priceMax === null) return null;
  const range =
    i.priceMax !== null && i.priceMax !== i.priceMin
      ? `${rupiah(i.priceMin ?? 0)} - ${rupiah(i.priceMax)}`
      : rupiah(i.priceMin ?? i.priceMax!);
  return `${range}${i.priceUnit ? ` ${PRICE_UNIT_LABELS[i.priceUnit as keyof typeof PRICE_UNIT_LABELS] ?? ''}` : ''}`;
}

function ResultCard({ item, rank }: { item: SearchItem; rank: number }) {
  const price = priceText(item);
  return (
    <Card size='sm'>
      <CardContent className='space-y-3'>
        <div className='flex items-start justify-between gap-4'>
          <div className='space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-sm'>#{rank}</span>
              <span className='font-semibold'>{item.name}</span>
              {item.category && <Badge variant='outline'>{item.category.name}</Badge>}
              {item.verification !== 'unverified' && (
                <Badge variant='secondary'>
                  {VERIFICATION_LABELS[item.verification as keyof typeof VERIFICATION_LABELS]}
                </Badge>
              )}
            </div>
            {item.summary && <p className='text-muted-foreground text-sm'>{item.summary}</p>}
            <p className='text-sm'>
              {[
                item.location &&
                  `${item.location.name}${item.location.parentName ? `, ${item.location.parentName}` : ''}`,
                item.distanceKm !== null && `${item.distanceKm.toFixed(1)} km`,
                price
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {item.whatsapp && (
              <a
                href={`https://wa.me/${item.whatsapp}`}
                target='_blank'
                rel='noopener noreferrer'
                className='text-sm underline'
              >
                WhatsApp {item.whatsapp}
              </a>
            )}
          </div>
          <div className='text-right'>
            <div className='text-2xl font-bold tabular-nums'>{(item.score * 100).toFixed(0)}</div>
            <div className='text-muted-foreground text-xs'>skor</div>
          </div>
        </div>

        <details className='text-sm'>
          <summary className='text-muted-foreground cursor-pointer'>Mengapa di urutan ini</summary>
          <div className='mt-3 space-y-2'>
            <div
              className='flex h-3 overflow-hidden rounded'
              role='img'
              aria-label='Kontribusi tiap sinyal terhadap skor'
            >
              {Object.entries(item.parts).map(([k, p]) => (
                <div
                  key={k}
                  title={`${SIGNAL_LABEL[k]}: nilai ${p!.value.toFixed(2)} x bobot ${(p!.weight * 100).toFixed(0)}%`}
                  style={{ width: `${p!.weight * p!.value * 100}%` }}
                  className='bg-primary/70 border-background border-r last:border-0'
                />
              ))}
            </div>
            <ul className='text-muted-foreground grid gap-x-6 sm:grid-cols-2'>
              {Object.entries(item.parts).map(([k, p]) => (
                <li key={k} className='flex justify-between'>
                  <span>{SIGNAL_LABEL[k]}</span>
                  <span className='tabular-nums'>
                    {p!.value.toFixed(2)} x {(p!.weight * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
            <div className='flex flex-wrap gap-1'>
              {item.reasons.map((r) => (
                <Badge key={r} variant='outline'>
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function DirectoryConsole() {
  const { data: options } = useSuspenseQuery(listingFormOptions());
  const [input, setInput] = useState<SearchInput>({ radiusKm: 15 });
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const mutation = useMutation({ mutationFn: (i: SearchInput) => runSearch(i) });

  const set = <K extends keyof SearchInput>(k: K, v: SearchInput[K] | '' | undefined) =>
    setInput((p) => ({ ...p, [k]: v === '' ? undefined : v }));
  const num = (s: string) => (s === '' ? undefined : Number(s));

  const go = (i: SearchInput) =>
    mutation.mutate(i, {
      onSuccess: setResponse,
      onError: () => toast.error('Pencarian gagal. Periksa isian Anda.')
    });

  const { understood, result, note } = response ?? { understood: null, result: null, note: null };

  return (
    <div className='w-full max-w-5xl space-y-4 pb-8'>
      <Card size='sm'>
        <CardHeader>
          <CardTitle>Pencarian</CardTitle>
          <CardDescription>
            Ketik seperti warga mengetik (Minang atau Indonesia). Kode memahami kata lewat kamus dan
            gazetteer, lalu mencari dan mengurutkan. Hanya listing berstatus Terbit yang ikut.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <form
            className='space-y-4'
            onSubmit={(e) => {
              e.preventDefault();
              go(input);
            }}
          >
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-1'>
                <Label htmlFor='q'>Cari apa</Label>
                <Input
                  id='q'
                  value={input.q ?? ''}
                  onChange={(e) => set('q', e.target.value)}
                  placeholder='mis. onda mogok, katering nasi kapau'
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='loc'>Di mana</Label>
                <Input
                  id='loc'
                  value={input.locationText ?? ''}
                  onChange={(e) =>
                    setInput((p) => ({
                      ...p,
                      locationText: e.target.value || undefined,
                      locationId: undefined
                    }))
                  }
                  placeholder='mis. Lubeg, Bukiktinggi, Pasa Raya'
                />
              </div>
            </div>
            <details>
              <summary className='text-muted-foreground cursor-pointer text-sm'>
                Filter tambahan
              </summary>
              <div className='mt-3 grid gap-4 md:grid-cols-3'>
                <div className='space-y-1'>
                  <Label htmlFor='cat'>Kategori (menimpa tebakan kamus)</Label>
                  <NativeSelect
                    id='cat'
                    className='w-full'
                    value={input.categoryId ?? ''}
                    onChange={(e) => set('categoryId', num(e.target.value))}
                  >
                    <NativeSelectOption value=''>(otomatis dari kata)</NativeSelectOption>
                    {options.categories.map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='budget'>Anggaran maksimum (Rp)</Label>
                  <Input
                    id='budget'
                    type='number'
                    min={0}
                    value={input.budget ?? ''}
                    onChange={(e) => set('budget', num(e.target.value))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='unit'>Satuan anggaran</Label>
                  <NativeSelect
                    id='unit'
                    className='w-full'
                    value={input.budgetUnit ?? ''}
                    onChange={(e) => set('budgetUnit', e.target.value)}
                  >
                    <NativeSelectOption value=''>(semua satuan)</NativeSelectOption>
                    {Object.entries(PRICE_UNIT_LABELS).map(([v, l]) => (
                      <NativeSelectOption key={v} value={v}>
                        {l}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='radius'>Radius (km)</Label>
                  <Input
                    id='radius'
                    type='number'
                    min={1}
                    max={100}
                    value={input.radiusKm ?? ''}
                    onChange={(e) => set('radiusKm', num(e.target.value))}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='mode'>Cara layanan</Label>
                  <NativeSelect
                    id='mode'
                    className='w-full'
                    value={input.serviceMode ?? ''}
                    onChange={(e) => set('serviceMode', e.target.value)}
                  >
                    <NativeSelectOption value=''>(bebas)</NativeSelectOption>
                    <NativeSelectOption value='on_site'>Datang ke tempat</NativeSelectOption>
                    <NativeSelectOption value='on_call'>Panggilan</NativeSelectOption>
                    <NativeSelectOption value='online'>Daring</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='ver'>Verifikasi minimum</Label>
                  <NativeSelect
                    id='ver'
                    className='w-full'
                    value={input.minVerification ?? ''}
                    onChange={(e) => set('minVerification', e.target.value)}
                  >
                    <NativeSelectOption value=''>(bebas)</NativeSelectOption>
                    <NativeSelectOption value='contact_checked'>Kontak dicek</NativeSelectOption>
                    <NativeSelectOption value='visited'>Dicek langsung</NativeSelectOption>
                  </NativeSelect>
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='cap'>Kapasitas minimum (gedung)</Label>
                  <Input
                    id='cap'
                    type='number'
                    min={1}
                    value={input.minCapacity ?? ''}
                    onChange={(e) => set('minCapacity', num(e.target.value))}
                  />
                </div>
              </div>
            </details>
            <div className='flex flex-wrap items-center gap-2'>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending ? 'Mencari...' : 'Cari'}
              </Button>
              <span className='text-muted-foreground text-sm'>Contoh:</span>
              {EXAMPLES.map((e) => (
                <Button
                  key={e.label}
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    const i = { radiusKm: 15, ...e.input };
                    setInput(i);
                    go(i);
                  }}
                >
                  {e.label}
                </Button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {understood && (
        <Card size='sm'>
          <CardHeader>
            <CardTitle>Dipahami sebagai</CardTitle>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <div>
              <span className='text-muted-foreground'>Kategori: </span>
              {understood.usedCategoryIds.length ? (
                <span className='inline-flex flex-wrap gap-1'>
                  {options.categories
                    .filter((c) => understood.usedCategoryIds.includes(c.id))
                    .map((c) => {
                      const via = understood.categories.find((m) => m.id === c.id)?.via;
                      return (
                        <Badge key={c.id} variant='secondary'>
                          {c.name}
                          {via ? ` · ${via}` : ' · dipilih manual'}
                        </Badge>
                      );
                    })}
                </span>
              ) : (
                <span>tidak ada (hanya mencocokkan kata)</span>
              )}
            </div>
            {understood.location && (
              <div>
                <span className='text-muted-foreground'>Lokasi "{understood.location.text}": </span>
                {understood.location.best ? (
                  <Badge variant='secondary'>
                    {understood.location.best.name} (
                    {understood.location.best.parentName ?? 'provinsi'}) ·{' '}
                    {understood.location.best.matchedBy}
                  </Badge>
                ) : understood.location.candidates.length ? (
                  <span className='inline-flex flex-wrap gap-1'>
                    {understood.location.candidates.map((c) => (
                      <Button
                        key={c.id}
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => go({ ...input, locationId: c.id })}
                      >
                        {c.name} ({c.parentName ?? 'provinsi'})
                      </Button>
                    ))}
                  </span>
                ) : (
                  <span className='text-destructive'>tidak dikenali</span>
                )}
              </div>
            )}
            {!understood.location && result?.applied.location && (
              <div>
                <span className='text-muted-foreground'>Lokasi: </span>
                <Badge variant='secondary'>{result.applied.location.name} · dipilih manual</Badge>
              </div>
            )}
            {result?.applied.origin && (
              <div className='text-muted-foreground'>
                Titik jarak:{' '}
                {result.applied.origin === 'near'
                  ? 'koordinat'
                  : result.applied.origin === 'lokasi'
                    ? 'titik lokasi'
                    : 'titik tengah kota induk (perkiraan)'}{' '}
                · radius {result.applied.radiusKm} km
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {note && (
        <Card size='sm'>
          <CardContent className='text-sm'>{note}</CardContent>
        </Card>
      )}

      {result && (
        <div className='space-y-3'>
          <p className='text-sm'>
            <strong>{result.total}</strong> listing cocok
            {result.truncated ? ' (dibatasi 500 kandidat)' : ''}
            {result.total > result.items.length
              ? `, menampilkan ${result.items.length} teratas`
              : ''}
            .
          </p>
          {result.items.map((item, i) => (
            <ResultCard key={item.id} item={item} rank={i + 1} />
          ))}
          {result.alternatives.length > 0 && (
            <Card size='sm'>
              <CardHeader>
                <CardTitle className='text-base'>
                  {result.total === 0
                    ? 'Tidak ada yang cocok. Coba:'
                    : 'Hasil sedikit. Bisa ditambah dengan:'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='list-disc space-y-1 pl-5 text-sm'>
                  {result.alternatives.map((a) => (
                    <li key={a.label}>
                      {a.label} <span className='text-muted-foreground'>→ {a.count} listing</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

const MODES = [
  { key: 'pintu', label: 'Pintu', hint: 'penyedia + slot kosong, seperti halaman pintu dan chat' },
  { key: 'direktori', label: 'Direktori', hint: 'kata bebas lewat kamus dan gazetteer' }
] as const;

export default function SearchConsole() {
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('pintu');
  return (
    <div className='space-y-4'>
      <div
        className='bg-card inline-flex rounded-xl p-[3px] shadow-sm'
        role='group'
        aria-label='Mode uji'
      >
        {MODES.map((m) => (
          <button
            key={m.key}
            type='button'
            aria-pressed={mode === m.key}
            title={m.hint}
            onClick={() => setMode(m.key)}
            className={cn(
              'h-9 rounded-[9px] px-4 text-sm transition-colors',
              mode === m.key
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground font-medium'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'pintu' ? <ProviderConsole /> : <DirectoryConsole />}
    </div>
  );
}
