'use client';
// Editor jadwal satu usaha: kalender + blokir, unit dan jam buka, libur/jam khusus, konflik.
// Dipakai di /mitra/jadwal dan di panel admin (props hanya listingId; server action mengizinkan admin
// atau mitra pemilik).
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSlot, jakartaDate } from '@/lib/engines/time';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import {
  deleteExceptionMutation,
  saveExceptionMutation,
  saveRulesMutation,
  saveUnitMutation,
  setUnitActiveMutation
} from '../api/mutations';
import { scheduleEditorOptions } from '../api/queries';
import type { ExceptionView, ScheduleEditorData, UnitView } from '../api/types';
import { minutesText, rupiah, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/format';
import {
  emptyPattern,
  exceptionSchema,
  type Pattern,
  type RuleKind,
  rulesFormSchema,
  unitSchema
} from '../schemas';
import { ScheduleCalendar } from './schedule-calendar';

// Senin dulu, Minggu terakhir (kebiasaan di Indonesia); nilai tetap 0 = Minggu seperti schedule_rules.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const clock = (t: string) => t.replace(':', '.');

function daysText(days: string[]) {
  const on = WEEK_ORDER.filter((d) => days.includes(String(d)));
  if (on.length === 7) return 'Setiap hari';
  // Rentang berurutan ≥ 3 hari jadi "Sen–Jum".
  const parts: string[] = [];
  for (let i = 0; i < on.length; ) {
    let j = i;
    while (j + 1 < on.length && WEEK_ORDER.indexOf(on[j + 1]) === WEEK_ORDER.indexOf(on[j]) + 1)
      j++;
    if (j - i >= 2) parts.push(`${WEEKDAYS_SHORT[on[i]]}–${WEEKDAYS_SHORT[on[j]]}`);
    else for (let k = i; k <= j; k++) parts.push(WEEKDAYS_SHORT[on[k]]);
    i = j + 1;
  }
  return parts.join(', ');
}

function patternText(kind: RuleKind, p: Pattern) {
  if (kind === 'seat')
    return [
      daysText(p.days),
      `berangkat ${clock(p.start)}`,
      `perjalanan ${minutesText(p.slotMinutes)}`,
      p.price != null && `${rupiah(p.price)}/kursi`
    ]
      .filter(Boolean)
      .join(' · ');
  return [
    daysText(p.days),
    `${clock(p.start)}–${clock(p.end)}`,
    `slot ${minutesText(p.slotMinutes)}`,
    p.gapMinutes > 0 && `jeda ${p.gapMinutes} menit`,
    p.minMinutes && `minimal ${minutesText(p.minMinutes)}`,
    p.price != null && rupiah(p.price),
    p.peakPrice != null &&
      `jam ramai ${clock(p.peakStart)}–${clock(p.peakEnd)} ${rupiah(p.peakPrice)}`
  ]
    .filter(Boolean)
    .join(' · ');
}

const card = 'bg-card rounded-xl p-4 shadow-sm';
const longDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});
/** "2026-10-20" → "Selasa, 20 Oktober" (tanggal kalender, tanpa zona waktu). */
const dateText = (d: string) => longDate.format(new Date(`${d}T00:00:00Z`));

// ───────────────────────────── Konflik ─────────────────────────────

function Conflicts({ data }: { data: ScheduleEditorData }) {
  if (!data.conflicts.length) return null;
  return (
    <section role='alert' className='rounded-xl bg-amber-500/15 p-4'>
      <h3 className='flex items-center gap-2 font-semibold'>
        <Icons.warning className='size-5 text-amber-700 dark:text-amber-300' aria-hidden />
        {data.conflicts.length} pesanan tidak cocok dengan jadwal terbaru
      </h3>
      <p className='mt-1 text-sm'>
        Pesanan ini tetap berlaku. Hubungi pemesan, atau kembalikan jam buka / buka blokirnya.
      </p>
      <ul className='mt-2 space-y-1 text-sm'>
        {data.conflicts.map((c) => (
          <li key={c.bookingId}>
            {c.href ? (
              <Link href={c.href} className='font-semibold underline underline-offset-4'>
                #{c.code}
              </Link>
            ) : (
              <b>#{c.code}</b>
            )}{' '}
            · {c.unitName} · {formatSlot(c.startsAt, c.endsAt)} ·{' '}
            {c.problem === 'closed' ? 'di luar jam buka' : 'terkena blokir'}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───────────────────────────── Unit ─────────────────────────────

function UnitForm({
  listingId,
  kind,
  unit,
  cities,
  onDone
}: {
  listingId: number;
  kind: RuleKind;
  unit: UnitView | null;
  cities: ScheduleEditorData['cities'];
  onDone: () => void;
}) {
  const save = useMutation(saveUnitMutation(listingId));
  const form = useAppForm({
    defaultValues: {
      name: unit?.name ?? '',
      capacity: unit?.capacity ?? (kind === 'seat' ? 10 : 1),
      originLocationId: unit?.originLocationId ? String(unit.originLocationId) : '',
      destinationLocationId: unit?.destinationLocationId ? String(unit.destinationLocationId) : ''
    },
    validators: { onSubmit: unitSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ unitId: unit?.id ?? null, input: value });
        toast.success(unit ? 'Unit disimpan' : 'Unit ditambahkan. Atur jam bukanya.');
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan unit');
      }
    }
  });
  const cityOptions = [
    { value: '', label: '(belum diisi)' },
    ...cities.map((c) => ({ value: String(c.id), label: c.name }))
  ];
  return (
    <form
      className='mt-3 space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name='name'
        children={(f) => (
          <f.TextField
            label={kind === 'seat' ? 'Nama rute' : 'Nama unit'}
            required
            placeholder={kind === 'seat' ? 'Padang → Bukittinggi' : 'Lapangan 1'}
          />
        )}
      />
      {kind === 'seat' && (
        <>
          <form.AppField
            name='capacity'
            children={(f) => (
              <f.TextField label='Jumlah kursi' required type='number' min={1} max={60} />
            )}
          />
          <div className='grid grid-cols-2 gap-2'>
            <form.AppField
              name='originLocationId'
              children={(f) => <f.SelectField label='Dari' options={cityOptions} />}
            />
            <form.AppField
              name='destinationLocationId'
              children={(f) => <f.SelectField label='Ke' options={cityOptions} />}
            />
          </div>
        </>
      )}
      <div className='grid grid-cols-2 gap-2'>
        <Button type='button' variant='outline' onClick={onDone}>
          Batal
        </Button>
        <form.AppForm>
          <form.SubmitButton>Simpan</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}

// ───────────────────────────── Jam buka ─────────────────────────────

function RulesForm({
  listingId,
  kind,
  unit,
  onDone
}: {
  listingId: number;
  kind: RuleKind;
  unit: UnitView;
  onDone: () => void;
}) {
  const save = useMutation(saveRulesMutation(listingId));
  const form = useAppForm({
    defaultValues: { patterns: unit.patterns.length ? unit.patterns : [emptyPattern(kind)] },
    validators: { onSubmit: rulesFormSchema(kind) },
    onSubmitInvalid: () => toast.error('Ada isian jam buka yang belum benar.'),
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ unitId: unit.id, patterns: value.patterns });
        toast.success('Jam buka disimpan');
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan jam buka');
      }
    }
  });
  const seat = kind === 'seat';
  return (
    <form
      className='mt-3 space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <p className='text-muted-foreground text-xs'>
        {seat
          ? 'Satu baris = satu jam keberangkatan. Pilih hari-harinya sekaligus.'
          : 'Boleh beberapa baris per hari (mis. istirahat siang). Jam tutup lebih kecil dari jam buka berarti lewat tengah malam. Mengubah jam buka tidak menghapus pesanan.'}
      </p>
      <form.Field
        name='patterns'
        mode='array'
        children={(list) => (
          <div className='space-y-3'>
            {list.state.value.map((_, i) => (
              <fieldset key={i} className='bg-muted/50 space-y-3 rounded-xl border p-3'>
                <legend className='px-1 text-sm font-semibold'>
                  {seat ? `Keberangkatan ${i + 1}` : `Jam buka ${i + 1}`}
                </legend>
                <form.Field
                  name={`patterns[${i}].days`}
                  mode='array'
                  children={(f) => {
                    const invalid = f.state.meta.isTouched && !f.state.meta.isValid;
                    return (
                      <div>
                        <div role='group' aria-label='Hari' className='grid grid-cols-7 gap-1'>
                          {WEEK_ORDER.map((d) => {
                            const v = String(d) as Pattern['days'][number];
                            const on = f.state.value.includes(v);
                            return (
                              <button
                                key={d}
                                type='button'
                                aria-pressed={on}
                                aria-label={WEEKDAYS[d]}
                                onClick={() =>
                                  f.handleChange(
                                    on
                                      ? f.state.value.filter((x) => x !== v)
                                      : [...f.state.value, v]
                                  )
                                }
                                className={cn(
                                  'focus-visible:ring-ring/50 h-11 rounded-lg border text-xs font-semibold outline-none focus-visible:ring-3',
                                  on
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card text-muted-foreground'
                                )}
                              >
                                {WEEKDAYS_SHORT[d]}
                              </button>
                            );
                          })}
                        </div>
                        {invalid && (
                          <p role='alert' className='text-destructive mt-1 text-sm'>
                            {f.state.meta.errors
                              .map((e) => (typeof e === 'string' ? e : e?.message))
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <div className='grid grid-cols-2 gap-2'>
                  <form.AppField
                    name={`patterns[${i}].start`}
                    children={(f) => (
                      <f.TextField
                        label={seat ? 'Jam berangkat' : 'Jam buka'}
                        type='time'
                        required
                      />
                    )}
                  />
                  {seat ? (
                    <form.AppField
                      name={`patterns[${i}].slotMinutes`}
                      children={(f) => (
                        <f.TextField
                          label='Lama perjalanan (menit)'
                          type='number'
                          min={5}
                          required
                        />
                      )}
                    />
                  ) : (
                    <form.AppField
                      name={`patterns[${i}].end`}
                      children={(f) => <f.TextField label='Jam tutup' type='time' required />}
                    />
                  )}
                </div>
                {!seat && (
                  <div className='grid grid-cols-2 gap-2'>
                    <form.AppField
                      name={`patterns[${i}].slotMinutes`}
                      children={(f) => (
                        <f.TextField label='Durasi slot (menit)' type='number' min={5} required />
                      )}
                    />
                    <form.AppField
                      name={`patterns[${i}].gapMinutes`}
                      children={(f) => (
                        <f.TextField label='Jeda antarslot (menit)' type='number' min={0} />
                      )}
                    />
                    <form.AppField
                      name={`patterns[${i}].minMinutes`}
                      children={(f) => (
                        <f.TextField label='Durasi minimal (menit)' type='number' min={5} />
                      )}
                    />
                  </div>
                )}
                <form.AppField
                  name={`patterns[${i}].price`}
                  children={(f) => (
                    <f.TextField
                      label={seat ? 'Harga per kursi (Rp)' : 'Harga per slot (Rp)'}
                      type='number'
                      min={0}
                      inputMode='numeric'
                    />
                  )}
                />
                {!seat && (
                  <details className='group'>
                    <summary className='flex min-h-11 cursor-pointer items-center text-sm font-semibold'>
                      Harga jam ramai (boleh kosong)
                    </summary>
                    <div className='grid grid-cols-2 gap-2'>
                      <div className='col-span-2'>
                        <form.AppField
                          name={`patterns[${i}].peakPrice`}
                          children={(f) => (
                            <f.TextField
                              label='Harga jam ramai (Rp)'
                              type='number'
                              min={0}
                              inputMode='numeric'
                            />
                          )}
                        />
                      </div>
                      <form.AppField
                        name={`patterns[${i}].peakStart`}
                        children={(f) => <f.TextField label='Mulai' type='time' />}
                      />
                      <form.AppField
                        name={`patterns[${i}].peakEnd`}
                        children={(f) => <f.TextField label='Sampai' type='time' />}
                      />
                    </div>
                  </details>
                )}
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='text-destructive h-11'
                  onClick={() => list.removeValue(i)}
                >
                  <Icons.trash aria-hidden /> Hapus baris ini
                </Button>
              </fieldset>
            ))}
            <Button
              type='button'
              variant='secondary'
              className='w-full'
              onClick={() => list.pushValue(emptyPattern(kind))}
            >
              <Icons.add aria-hidden /> {seat ? 'Tambah keberangkatan' : 'Tambah jam buka'}
            </Button>
          </div>
        )}
      />
      <div className='grid grid-cols-2 gap-2'>
        <Button type='button' variant='outline' onClick={onDone}>
          Batal
        </Button>
        <form.AppForm>
          <form.SubmitButton>Simpan jam buka</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}

function UnitsPanel({ listingId, data }: { listingId: number; data: ScheduleEditorData }) {
  const kind = data.listing.scheduleKind as RuleKind;
  const seat = kind === 'seat';
  const [edit, setEdit] = useState<{ id: number | 'new'; what: 'unit' | 'rules' } | null>(null);
  const toggle = useMutation(setUnitActiveMutation(listingId));
  const city = (id: number | null) => data.cities.find((c) => c.id === id)?.name;

  return (
    <div className='space-y-3'>
      {data.units.map((u) => {
        const open = edit?.id === u.id ? edit.what : null;
        const route = [city(u.originLocationId), city(u.destinationLocationId)];
        return (
          <article key={u.id} className={cn(card, !u.isActive && 'opacity-80')}>
            <div className='flex items-start justify-between gap-2'>
              <div className='min-w-0'>
                <h4 className='font-semibold'>{u.name}</h4>
                <p className='text-muted-foreground text-sm'>
                  {[
                    seat && `${u.capacity} kursi`,
                    seat && route.every(Boolean) && route.join(' → '),
                    !u.isActive && 'Nonaktif'
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            {open !== 'rules' && (
              <ul className='mt-2 space-y-1 text-sm'>
                {u.patterns.length ? (
                  u.patterns.map((p, i) => <li key={i}>{patternText(kind, p)}</li>)
                ) : (
                  <li className='text-muted-foreground'>Belum ada jam buka.</li>
                )}
              </ul>
            )}
            {open === 'unit' && (
              <UnitForm
                listingId={listingId}
                kind={kind}
                unit={u}
                cities={data.cities}
                onDone={() => setEdit(null)}
              />
            )}
            {open === 'rules' && (
              <RulesForm listingId={listingId} kind={kind} unit={u} onDone={() => setEdit(null)} />
            )}
            {!open && (
              <div className='mt-3 flex flex-wrap gap-2'>
                <Button
                  size='sm'
                  className='h-11'
                  onClick={() => setEdit({ id: u.id, what: 'rules' })}
                >
                  <Icons.clock aria-hidden /> {seat ? 'Atur keberangkatan' : 'Atur jam buka'}
                </Button>
                <Button
                  size='sm'
                  variant='secondary'
                  className='h-11'
                  onClick={() => setEdit({ id: u.id, what: 'unit' })}
                >
                  <Icons.edit aria-hidden /> Ubah
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-11'
                  disabled={toggle.isPending}
                  onClick={() =>
                    toggle.mutate(
                      { unitId: u.id, active: !u.isActive },
                      {
                        onSuccess: () =>
                          toast.success(u.isActive ? 'Unit dinonaktifkan' : 'Unit diaktifkan'),
                        onError: (e) => toast.error(e.message)
                      }
                    )
                  }
                >
                  {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </div>
            )}
          </article>
        );
      })}
      {edit?.id === 'new' ? (
        <div className={card}>
          <h4 className='font-semibold'>{seat ? 'Rute baru' : 'Unit baru'}</h4>
          <UnitForm
            listingId={listingId}
            kind={kind}
            unit={null}
            cities={data.cities}
            onDone={() => setEdit(null)}
          />
        </div>
      ) : (
        <Button
          variant='secondary'
          className='w-full'
          onClick={() => setEdit({ id: 'new', what: 'unit' })}
        >
          <Icons.add aria-hidden /> {seat ? 'Tambah rute' : 'Tambah unit'}
        </Button>
      )}
    </div>
  );
}

// ───────────────────────────── Libur dan jam khusus ─────────────────────────────

function ExceptionsPanel({ listingId, data }: { listingId: number; data: ScheduleEditorData }) {
  const save = useMutation(saveExceptionMutation(listingId));
  const remove = useMutation(deleteExceptionMutation(listingId));
  const today = jakartaDate(new Date());
  const form = useAppForm({
    defaultValues: { date: today, unitId: '', closed: true, start: '', end: '', note: '' },
    validators: { onSubmit: exceptionSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync(value);
        toast.success('Pengecualian disimpan');
        form.reset();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
      }
    }
  });
  const unitName = (id: number | null) =>
    id === null ? 'Semua unit' : (data.units.find((u) => u.id === id)?.name ?? 'Unit');
  const describe = (e: ExceptionView) =>
    e.isClosed ? 'Tutup' : `Buka ${clock(e.startTime ?? '')}–${clock(e.endTime ?? '')}`;

  return (
    <div className='space-y-3'>
      <section className={card}>
        <h4 className='font-semibold'>Libur atau jam khusus</h4>
        <p className='text-muted-foreground mt-1 text-xs'>
          Menggantikan jam buka mingguan pada tanggal itu. Pesanan yang sudah ada tetap berlaku.
        </p>
        <form
          className='mt-3 space-y-3'
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <div className='grid grid-cols-2 gap-2'>
            <form.AppField
              name='date'
              children={(f) => <f.TextField label='Tanggal' type='date' min={today} required />}
            />
            <form.AppField
              name='unitId'
              children={(f) => (
                <f.SelectField
                  label='Berlaku untuk'
                  options={[
                    { value: '', label: 'Semua unit' },
                    ...data.units.map((u) => ({ value: String(u.id), label: u.name }))
                  ]}
                />
              )}
            />
          </div>
          <form.Field
            name='closed'
            children={(f) => (
              <div
                role='group'
                aria-label='Jenis'
                className='bg-muted grid grid-cols-2 rounded-xl p-1'
              >
                {[
                  { v: true, t: 'Tutup seharian' },
                  { v: false, t: 'Jam khusus' }
                ].map((o) => (
                  <button
                    key={o.t}
                    type='button'
                    aria-pressed={f.state.value === o.v}
                    onClick={() => f.handleChange(o.v)}
                    className={cn(
                      'focus-visible:ring-ring/50 min-h-11 rounded-lg text-sm font-semibold outline-none focus-visible:ring-3',
                      f.state.value === o.v ? 'bg-card shadow-sm' : 'text-muted-foreground'
                    )}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
            )}
          />
          <form.Subscribe selector={(s) => s.values.closed}>
            {(closed) =>
              !closed && (
                <div className='grid grid-cols-2 gap-2'>
                  <form.AppField
                    name='start'
                    children={(f) => <f.TextField label='Jam buka' type='time' required />}
                  />
                  <form.AppField
                    name='end'
                    children={(f) => <f.TextField label='Jam tutup' type='time' required />}
                  />
                </div>
              )
            }
          </form.Subscribe>
          <form.AppField
            name='note'
            children={(f) => (
              <f.TextField label='Catatan (boleh kosong)' placeholder='Mis. Idulfitri' />
            )}
          />
          <form.AppForm>
            <form.SubmitButton className='w-full'>Simpan pengecualian</form.SubmitButton>
          </form.AppForm>
        </form>
      </section>

      <section className={card}>
        <h4 className='mb-2 font-semibold'>Tanggal khusus mendatang</h4>
        {data.exceptions.length ? (
          <ul className='divide-y'>
            {data.exceptions.map((e) => (
              <li key={e.id} className='flex items-center gap-2 py-2'>
                <div className='min-w-0 flex-1 text-sm'>
                  <p className='font-semibold'>{dateText(e.date)}</p>
                  <p className='text-muted-foreground'>
                    {[describe(e), unitName(e.unitId), e.note].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  variant='ghost'
                  size='icon-lg'
                  aria-label={`Hapus pengecualian ${dateText(e.date)}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(e.id, {
                      onSuccess: () => toast.success('Pengecualian dihapus'),
                      onError: (err) => toast.error(err.message)
                    })
                  }
                >
                  <Icons.trash aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>Belum ada.</p>
        )}
      </section>
    </div>
  );
}

// ───────────────────────────── Editor ─────────────────────────────

const TABS = [
  { key: 'kalender', label: 'Kalender' },
  { key: 'jam', label: 'Jam buka' },
  { key: 'libur', label: 'Libur' }
] as const;

export function ScheduleEditor({ listingId }: { listingId: number }) {
  const { data, isPending, isError } = useQuery(scheduleEditorOptions(listingId));
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('kalender');

  if (isPending)
    return (
      <div className='space-y-3'>
        <Skeleton className='h-12 rounded-xl' />
        <Skeleton className='h-64 rounded-xl' />
      </div>
    );
  if (isError || !data)
    return (
      <p role='alert' className='text-destructive text-sm'>
        Jadwal gagal dimuat. Muat ulang halaman.
      </p>
    );
  const kind = data.listing.scheduleKind;
  if (kind !== 'slot' && kind !== 'seat')
    return (
      <p className={cn(card, 'text-muted-foreground text-sm')}>
        Kategori usaha ini tidak memakai jadwal slot atau kursi. Pesanan masuk sebagai permintaan.
      </p>
    );
  const active = data.units.filter((u) => u.isActive);

  return (
    <div className='space-y-3'>
      <Conflicts data={data} />
      <div
        role='tablist'
        aria-label='Bagian jadwal'
        className='bg-card grid grid-cols-3 rounded-xl p-1'
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type='button'
            role='tab'
            id={`jadwal-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`jadwal-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cn(
              'focus-visible:ring-ring/50 min-h-11 rounded-lg text-sm font-semibold outline-none focus-visible:ring-3',
              tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role='tabpanel' id={`jadwal-panel-${tab}`} aria-labelledby={`jadwal-tab-${tab}`}>
        {tab === 'kalender' && (
          <div className={card}>
            <ScheduleCalendar listingId={listingId} kind={kind} units={active} />
          </div>
        )}
        {tab === 'jam' && <UnitsPanel listingId={listingId} data={data} />}
        {tab === 'libur' && <ExceptionsPanel listingId={listingId} data={data} />}
      </div>
    </div>
  );
}
