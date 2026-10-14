'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CategoryPicker } from '@/components/forms/category-picker';
import { Chip } from '@/components/forms/chip';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { saveMyListingMutation } from '@/features/vendor/api/mutations';
import { PhotoManager, StagedPhotos, uploadPhotos } from './photo-manager';
import { createListingMutation, updateListingMutation } from '../api/mutations';
import { similarListingsOptions } from '../api/queries';
import type { ListingDetail, ListingOptions } from '../api/types';
import {
  LOCATION_LEVEL_LABELS,
  PRICE_UNIT_OPTIONS,
  SERVICE_MODES,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  VERIFICATION_LABELS,
  VERIFICATION_OPTIONS,
  type ServiceMode
} from '../constants/listing-options';
import {
  formatAttributeValue,
  formatDuration,
  normalizeWhatsapp,
  parseMapsCoords,
  type AttributeDef,
  type AttributeValue
} from '../lib/format';
import { emptyListingForm, listingFormSchema, type ListingFormValues } from '../schemas/listing';

const two = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2';
const checks = 'grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3';

const MODE_SHORT: Record<ServiceMode, string> = {
  on_site: 'Pelanggan datang',
  on_call: 'Panggilan',
  online: 'Daring'
};

const MODE_HINT: Record<ServiceMode, string> = {
  on_site: 'Pelanggan datang ke tempat usaha',
  on_call: 'Usaha datang ke lokasi pelanggan',
  online: 'Dilayani lewat internet atau telepon'
};

const levelLabel = (level: string) => {
  const t = LOCATION_LEVEL_LABELS[level] ?? level;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>{title}</h3>
      {description && <p className='text-muted-foreground mt-1 text-[0.8125rem]'>{description}</p>}
      <FieldGroup className='mt-4 gap-3.5'>{children}</FieldGroup>
    </section>
  );
}

/** Judul untuk isian yang bukan kolom teks (pilihan kategori, pilihan cepat). */
const Lab = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className='mb-1.5 text-[0.8125rem] leading-snug font-semibold'>
    {children}
    {hint && <small className='text-muted-foreground ml-1.5 font-normal'>{hint}</small>}
  </div>
);

/** Pilihan cepat bergaya segmen. Dipakai untuk Ya/Tidak dan cara layanan. */
const segWrap = 'bg-muted inline-flex w-fit max-w-full flex-wrap rounded-xl p-[3px]';
const segBtn = (on: boolean) =>
  cn(
    'h-8 rounded-[9px] px-3.5 text-sm transition-colors',
    on ? 'bg-card text-foreground font-semibold shadow-sm' : 'text-muted-foreground font-medium'
  );

/** Isian Ya/Tidak: tiga pilihan agar "belum diisi" tetap bisa dibedakan dari "tidak". */
function YesNoInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
}) {
  const options: { text: string; v: boolean | undefined }[] = [
    { text: 'Belum diisi', v: undefined },
    { text: 'Ya', v: true },
    { text: 'Tidak', v: false }
  ];
  return (
    <div>
      <Lab>{label}</Lab>
      <div role='group' aria-label={label} className={segWrap}>
        {options.map((o) => (
          <button
            key={o.text}
            type='button'
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={segBtn(value === o.v)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Isian rupiah: angka dengan pemisah ribuan dan awalan "Rp". Disimpan sebagai bilangan bulat. */
function RupiahInput({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (v: number | undefined) => void;
}) {
  const n = typeof value === 'number' ? value : undefined;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className='relative'>
        <span className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm'>
          Rp
        </span>
        <Input
          id={id}
          inputMode='numeric'
          className='pl-9'
          placeholder='0'
          value={n === undefined ? '' : n.toLocaleString('id-ID')}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
            onChange(digits ? Number(digits) : undefined);
          }}
        />
      </div>
    </Field>
  );
}

/** Isian durasi: jumlah menit, dengan pratinjau "1 jam 30 menit". */
function DurationInput({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (v: number | undefined) => void;
}) {
  const n = typeof value === 'number' ? value : undefined;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className='relative'>
        <Input
          id={id}
          type='number'
          min={0}
          step={5}
          className='pr-16'
          value={n ?? ''}
          onChange={(e) =>
            onChange(
              e.target.value === '' ? undefined : Math.max(0, Math.round(Number(e.target.value)))
            )
          }
        />
        <span className='text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm'>
          menit
        </span>
      </div>
      {n !== undefined && n > 0 && <FieldDescription>= {formatDuration(n)}</FieldDescription>}
    </Field>
  );
}

/** Ringkasan isian khusus untuk kartu pratinjau, mis. "Terima BPJS · IGD 24 jam · 3 poli". */
function attributeSummary(
  attrs: AttributeDef[],
  values: Record<string, AttributeValue | undefined>
) {
  const out: string[] = [];
  for (const a of attrs) {
    const v = values[a.key];
    if (v === undefined || v === '') continue;
    if (a.type === 'boolean') {
      if (v === true) out.push(a.label);
    } else if (a.type === 'multiselect') {
      if (Array.isArray(v) && v.length) out.push(`${v.length} ${a.label.toLowerCase()}`);
    } else
      out.push(
        a.type === 'text' || a.type === 'select'
          ? String(v)
          : `${a.label} ${formatAttributeValue(a, v)}`
      );
  }
  return out.slice(0, 4).join(' · ');
}

const filledAttributes = (
  attrs: AttributeDef[],
  values: Record<string, AttributeValue | undefined>
) =>
  attrs.filter((a) => {
    const v = values[a.key];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;

/** Kolom samping: pratinjau kartu di chat dan kelengkapan isian. */
function SidePanels({ v, options }: { v: ListingFormValues; options: ListingOptions }) {
  const cat = options.categories.find((c) => String(c.id) === v.primaryCategoryId);
  const loc = options.locations.find((l) => String(l.id) === v.locationId);
  const attrs = cat?.attributes ?? [];
  const wa = normalizeWhatsapp(v.whatsapp);
  const place = [loc?.name, loc?.path].filter(Boolean).join(', ');
  const modes = v.serviceModes.map((m) => MODE_SHORT[m as ServiceMode]).filter(Boolean);
  const summary = attributeSummary(attrs, v.attributes);
  const verified = v.verificationLevel !== 'unverified';

  const items = [
    {
      done: !!(v.name.trim() && v.primaryCategoryId && v.locationId),
      label: 'Nama, kategori, lokasi',
      todo: 'Isi nama, kategori, dan lokasi'
    },
    { done: !!v.summary.trim(), label: 'Ringkasan', todo: 'Tambah ringkasan' },
    ...(cat?.infoOnly
      ? []
      : [
          {
            done: !!(wa || v.phone.trim()),
            label: 'Kontak',
            todo: 'Tambah kontak WhatsApp'
          }
        ]),
    {
      done: v.lat !== undefined && v.lng !== undefined,
      label: 'Koordinat peta',
      todo: 'Tambah koordinat peta'
    },
    ...(attrs.length
      ? [
          {
            done: filledAttributes(attrs, v.attributes) > 0,
            label: 'Isian khusus',
            todo: 'Lengkapi isian khusus'
          }
        ]
      : []),
    {
      done: v.priceMin !== undefined || !!v.priceNote.trim(),
      label: 'Harga',
      todo: 'Tambah harga'
    }
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  const ordered = [...items.filter((i) => i.done), ...items.filter((i) => !i.done)];

  return (
    <>
      <section className='bg-card rounded-xl p-5 shadow-sm'>
        <h3 className='mb-3.5 text-[1.0625rem] font-semibold'>Seperti tampil di chat</h3>
        <div className='rounded-2xl border p-3.5'>
          <h4
            className={cn(
              'mb-1.5 text-[0.9375rem] font-semibold',
              !v.name.trim() && 'text-muted-foreground'
            )}
          >
            {v.name.trim() || 'Nama usaha'}
          </h4>
          <div className='flex flex-wrap gap-1.5'>
            <span className='bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold'>
              {cat?.name ?? 'Kategori'}
            </span>
            {verified && (
              <span className='rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300'>
                ✓ {VERIFICATION_LABELS[v.verificationLevel]}
              </span>
            )}
          </div>
          <p className='text-muted-foreground mt-2.5 text-[0.8125rem]'>
            {[place || 'Lokasi belum dipilih', modes.join(', ')].filter(Boolean).join(' · ')}
          </p>
          {(summary || v.priceMin !== undefined) && (
            <p className='mt-1.5 text-[0.8125rem]'>
              {[summary, v.priceMin !== undefined && `mulai ${rupiah(v.priceMin)}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {wa && !cat?.infoOnly && (
            <span className='mt-3 flex h-[34px] items-center justify-center rounded-full bg-emerald-600 text-[0.8125rem] font-semibold text-white'>
              Hubungi via WhatsApp
            </span>
          )}
        </div>
      </section>

      <section className='bg-card rounded-xl p-5 shadow-sm'>
        <h3 className='mb-3.5 text-[1.0625rem] font-semibold'>Kelengkapan</h3>
        <div className='flex items-center gap-4'>
          <div
            role='img'
            aria-label={`Kelengkapan ${percent} persen`}
            className='grid size-[84px] shrink-0 place-items-center rounded-full'
            style={{
              background: `conic-gradient(var(--primary-hi) ${percent}%, var(--muted) 0)`
            }}
          >
            <span className='bg-card grid size-[66px] place-items-center rounded-full text-xl font-semibold'>
              {percent}%
            </span>
          </div>
          <ul className='grid gap-2 text-[0.8125rem]'>
            {ordered.map((i) => (
              <li
                key={i.label}
                className={cn('flex items-center gap-2', !i.done && 'text-muted-foreground')}
              >
                {i.done && <Icons.check className='size-[15px] shrink-0 text-emerald-600' />}
                {i.done ? i.label : i.todo}
              </li>
            ))}
          </ul>
        </div>
        <p className='text-muted-foreground mt-3.5 text-[0.78rem]'>
          Listing yang lebih lengkap lebih mudah ditemukan di hasil pencarian.
        </p>
      </section>
    </>
  );
}

/** Peringatan bila nama atau nomor WhatsApp sudah dipakai listing lain. Tidak menghalangi simpan. */
function SimilarBanner({
  name,
  whatsapp,
  excludeId
}: {
  name: string;
  whatsapp: string;
  excludeId?: number;
}) {
  // Menunggu berhenti mengetik. Mulai kosong, jadi tidak ada panggilan saat render di server.
  const [q, setQ] = useState({ name: '', whatsapp: '' });
  useEffect(() => {
    const t = setTimeout(
      () => setQ({ name: name.trim(), whatsapp: normalizeWhatsapp(whatsapp) ? whatsapp : '' }),
      600
    );
    return () => clearTimeout(t);
  }, [name, whatsapp]);

  const { data } = useQuery({
    ...similarListingsOptions(q.name, q.whatsapp, excludeId),
    enabled: q.name.length >= 3 || !!q.whatsapp
  });
  const first = data?.[0];
  if (!first) return null;
  const rest = data.length - 1;
  return (
    <div
      role='status'
      className='mb-3.5 flex items-start gap-3 rounded-2xl bg-amber-500/15 px-4 py-3.5 text-[0.9375rem]'
    >
      <Icons.warning className='mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300' />
      <p>
        <b>Mirip dengan listing yang sudah ada:</b> &ldquo;{first.name}&rdquo;
        {first.locationName ? ` di ${first.locationName}` : ''}
        {first.reason === 'whatsapp' ? ' (nomor WhatsApp sama)' : ''}
        {rest > 0 ? `, dan ${rest} lainnya` : ''}.{' '}
        <Link
          href={`/dashboard/listings/${first.id}`}
          target='_blank'
          className='text-primary font-semibold underline underline-offset-4'
        >
          Lihat listing itu
        </Link>{' '}
        sebelum membuat yang baru.
      </p>
    </div>
  );
}

export default function ListingForm({
  options,
  detail,
  pageTitle,
  mode = 'admin'
}: {
  options: ListingOptions;
  detail?: ListingDetail;
  pageTitle: string;
  /** `vendor`: pemilik usaha. Tanpa status/verifikasi/sumber; disimpan lewat portal vendor. */
  mode?: 'admin' | 'vendor';
}) {
  const router = useRouter();
  const isEdit = !!detail;
  const isVendor = mode === 'vendor';
  const prevStatus = detail?.values.status;
  const [showExtra, setShowExtra] = useState((detail?.values.extraCategoryIds.length ?? 0) > 0);

  // Foto yang dipilih sebelum listing ada; diunggah sesudah listing dibuat.
  const [staged, setStaged] = useState<File[]>([]);
  const uploadStaged = async (id: number) => {
    if (!staged.length) return;
    const failed = await uploadPhotos(id, staged);
    if (failed)
      toast.error(
        `${failed} foto gagal diunggah. Buka listing ini lagi untuk menambahkannya kembali.`
      );
  };

  const create = useMutation(createListingMutation);
  const update = useMutation(updateListingMutation);
  const vendorSave = useMutation(saveMyListingMutation);

  const form = useAppForm({
    // "Simpan listing" menerbitkan; "Simpan sebagai draf" menyimpan tanpa tampil ke warga.
    defaultValues:
      detail?.values ??
      (isVendor ? emptyListingForm : { ...emptyListingForm, status: 'published' as const }),
    validators: { onSubmit: listingFormSchema },
    onSubmitMeta: { asDraft: false },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value, meta }) => {
      if (isVendor) {
        try {
          const r = await vendorSave.mutateAsync({
            id: detail?.id ?? null,
            values: value,
            intent: meta.asDraft ? 'draft' : 'submit'
          });
          if (!detail) await uploadStaged(r.id);
          toast.success(r.message);
          router.push('/mitra/usaha');
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Gagal menyimpan listing');
        }
        return;
      }
      const values = meta.asDraft ? { ...value, status: 'draft' as const } : value;
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values });
        else await uploadStaged((await create.mutateAsync(values)).id);
        toast.success(
          meta.asDraft ? 'Disimpan sebagai draf' : isEdit ? 'Listing disimpan' : 'Listing dibuat'
        );
        router.push('/dashboard/listings');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan listing');
      }
    }
  });

  const locationOptions = options.locations.map((l) => ({
    value: String(l.id),
    label: l.name,
    description: [levelLabel(l.level), l.path].filter(Boolean).join(' · ')
  }));
  const areaOptions = options.locations
    .filter((l) => l.level === 'province' || l.level === 'city')
    .map((l) => ({ value: String(l.id), label: l.name }));

  return (
    <form
      className='w-full max-w-6xl pb-8'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className='mb-[22px]'>
        <h2 className='text-[1.75rem] leading-[1.15] font-bold tracking-tight md:text-4xl'>
          {pageTitle}
        </h2>
        <p className='text-muted-foreground mt-1.5 text-[0.9375rem]'>
          {isVendor
            ? 'Setelah dikirim, tim Kamanga memeriksa listing ini sebelum tampil ke warga.'
            : isEdit
              ? 'Perubahan langsung dipakai chatbot bila statusnya Terbit.'
              : 'Isi yang wajib dulu. Sisanya bisa dilengkapi kemudian.'}
        </p>
      </div>

      {isVendor && prevStatus === 'rejected' && (
        <div role='alert' className='mb-3.5 rounded-2xl bg-red-500/10 px-4 py-3.5 text-[0.9375rem]'>
          <b>Listing ini ditolak.</b> {detail?.values.reviewNote || 'Periksa kembali isiannya'}.
          Perbaiki lalu kirim ulang.
        </div>
      )}
      {isVendor && prevStatus === 'published' && detail?.values.reviewNote && (
        <div role='alert' className='mb-3.5 rounded-2xl bg-red-500/10 px-4 py-3.5 text-[0.9375rem]'>
          {detail.values.reviewNote}
        </div>
      )}
      {isVendor && prevStatus === 'published' && (
        <div className='mb-3.5 rounded-2xl bg-sky-500/10 px-4 py-3.5 text-[0.9375rem]'>
          Listing ini sudah tampil ke warga. Mengubah <b>nama, kategori, ringkasan, atau kontak</b>{' '}
          membuatnya diperiksa ulang dan sementara tidak tampil. Perubahan lain langsung berlaku.
        </div>
      )}

      {!isVendor && (
        <form.Subscribe selector={(s) => s.values}>
          {(v) => <SimilarBanner name={v.name} whatsapp={v.whatsapp} excludeId={detail?.id} />}
        </form.Subscribe>
      )}

      <div className='grid items-start gap-4 min-[1181px]:grid-cols-[minmax(0,1fr)_340px]'>
        <div className='min-w-0 space-y-3.5'>
          <Section
            title='Informasi dasar'
            description='Yang tampil pertama kali di kartu hasil pencarian.'
          >
            {!isVendor && (
              <form.Field
                name='kind'
                children={(field) => (
                  <div>
                    <Lab hint='Tempat tidak punya tombol pesan'>Jenis</Lab>
                    <div role='radiogroup' aria-label='Jenis listing' className={segWrap}>
                      {(
                        [
                          ['provider', 'Penyedia (bisa dipesan)'],
                          ['place', 'Tempat (informasi saja)']
                        ] as const
                      ).map(([k, text]) => (
                        <button
                          key={k}
                          type='button'
                          role='radio'
                          aria-checked={field.state.value === k}
                          onClick={() => field.handleChange(k)}
                          className={segBtn(field.state.value === k)}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              />
            )}
            <div className={two}>
              <form.AppField
                name='name'
                children={(f) => (
                  <f.TextField
                    label='Nama usaha'
                    required
                    placeholder='Mis. Katering Uni Et'
                    autoFocus={!isEdit}
                  />
                )}
              />
              <form.AppField
                name='slug'
                children={(f) => (
                  <f.TextField
                    label='Alamat web (slug)'
                    hint='otomatis'
                    placeholder='katering-uni-et'
                  />
                )}
              />
            </div>

            <form.Field
              name='primaryCategoryId'
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <div>
                    <Lab>Kategori utama *</Lab>
                    <CategoryPicker
                      categories={options.categories}
                      invalid={invalid}
                      isOn={(id) => String(id) === field.state.value}
                      onPick={(id) => {
                        field.handleChange(String(id));
                        // kategori utama tidak perlu diulang di kategori tambahan
                        const extras = form.getFieldValue('extraCategoryIds');
                        if (extras.includes(String(id)))
                          form.setFieldValue(
                            'extraCategoryIds',
                            extras.filter((x) => x !== String(id))
                          );
                      }}
                    />
                    {invalid && (
                      <div className='mt-2'>
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <form.Subscribe selector={(s) => s.values.primaryCategoryId}>
              {(primary) =>
                showExtra ? (
                  <form.Field
                    name='extraCategoryIds'
                    mode='array'
                    children={(field) => (
                      <div>
                        <Lab hint='bila usaha ini juga cocok di kategori lain'>
                          Juga masuk kategori
                        </Lab>
                        <CategoryPicker
                          categories={options.categories}
                          isOn={(id) => field.state.value.includes(String(id))}
                          isDisabled={(id) => String(id) === primary}
                          onPick={(id) =>
                            field.handleChange(
                              field.state.value.includes(String(id))
                                ? field.state.value.filter((x) => x !== String(id))
                                : [...field.state.value, String(id)]
                            )
                          }
                        />
                      </div>
                    )}
                  />
                ) : (
                  <button
                    type='button'
                    onClick={() => setShowExtra(true)}
                    className='text-muted-foreground hover:text-foreground -mt-1 w-fit text-xs underline-offset-4 hover:underline'
                  >
                    + Masuk juga ke kategori lain
                  </button>
                )
              }
            </form.Subscribe>

            <form.AppField
              name='summary'
              children={(f) => (
                <f.TextareaField
                  label='Ringkasan'
                  hint='1–2 kalimat untuk kartu hasil pencarian'
                  maxLength={200}
                  showCount
                  rows={2}
                />
              )}
            />
            <form.AppField
              name='description'
              children={(f) => <f.TextareaField label='Deskripsi lengkap' rows={3} />}
            />
            <form.AppField
              name='keywords'
              mode='array'
              children={(f) => (
                <f.TagsField
                  label='Kata kunci tambahan'
                  placeholder='Ketik lalu Enter. Mis. orgen tunggal'
                />
              )}
            />
          </Section>

          <Section
            title='Foto'
            description={
              isVendor
                ? 'Foto pertama jadi sampul. Foto baru diperiksa tim dulu sebelum tampil ke warga.'
                : 'Foto pertama jadi sampul. Foto yang Anda tambahkan langsung tampil bila listing terbit.'
            }
          >
            {detail ? (
              <PhotoManager
                listingId={detail.id}
                isVendor={isVendor}
                initial={{ photos: detail.photos, pending: detail.pendingPhotos }}
              />
            ) : (
              <StagedPhotos files={staged} onChange={setStaged} isVendor={isVendor} />
            )}
          </Section>

          <form.Subscribe selector={(s) => s.values.primaryCategoryId}>
            {(primaryId) => {
              const cat = options.categories.find((c) => String(c.id) === primaryId);
              const attrs = cat?.attributes ?? [];
              if (!cat || !attrs.length) return null;
              return (
                <Section
                  title={`Isian khusus: ${cat.name}`}
                  description='Muncul otomatis sesuai kategori yang dipilih.'
                >
                  <div className={two}>
                    {attrs.map((a) => {
                      const name = `attributes.${a.key}` as const;
                      if (a.type === 'boolean')
                        return (
                          <form.Field
                            key={a.key}
                            name={name}
                            children={(f) => (
                              <YesNoInput
                                label={a.label}
                                value={f.state.value as boolean | undefined}
                                onChange={(v) => f.handleChange(v)}
                              />
                            )}
                          />
                        );
                      if (a.type === 'select')
                        return (
                          <form.AppField
                            key={a.key}
                            name={name}
                            children={(f) => (
                              <f.SelectField
                                label={a.label}
                                placeholder='Pilih'
                                options={[
                                  { value: '', label: '(belum diisi)' },
                                  ...(a.options ?? []).map((o) => ({ value: o, label: o }))
                                ]}
                              />
                            )}
                          />
                        );
                      if (a.type === 'rupiah' || a.type === 'duration') {
                        const Comp = a.type === 'rupiah' ? RupiahInput : DurationInput;
                        return (
                          <form.Field
                            key={a.key}
                            name={name}
                            children={(f) => (
                              <Comp
                                id={f.name}
                                label={a.label}
                                value={f.state.value}
                                onChange={(v) => f.handleChange(v)}
                              />
                            )}
                          />
                        );
                      }
                      if (a.type === 'multiselect')
                        return (
                          <div key={a.key} className='sm:col-span-2'>
                            <form.AppField
                              name={name}
                              mode='array'
                              defaultValue={[]}
                              children={(f) => (
                                <f.CheckboxGroupField
                                  label={a.label}
                                  options={(a.options ?? []).map((o) => ({ value: o, label: o }))}
                                  className={checks}
                                />
                              )}
                            />
                          </div>
                        );
                      return (
                        <form.AppField
                          key={a.key}
                          name={name}
                          children={(f) => (
                            <f.TextField
                              label={a.label}
                              type={a.type === 'number' ? 'number' : 'text'}
                            />
                          )}
                        />
                      );
                    })}
                  </div>
                </Section>
              );
            }}
          </form.Subscribe>

          <Section
            title='Lokasi dan kontak'
            description='Semua kontak boleh kosong, mis. untuk objek wisata umum.'
          >
            <form.AppField
              name='locationId'
              children={(f) => (
                <f.ComboboxField
                  label='Lokasi'
                  options={locationOptions}
                  placeholder='Pilih lokasi'
                  searchPlaceholder='Cari nagari, kecamatan, atau kota...'
                />
              )}
            />
            <form.Field
              name='serviceModes'
              mode='array'
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <div>
                    <Lab hint='boleh lebih dari satu'>Cara layanan *</Lab>
                    <div
                      role='group'
                      aria-label='Cara layanan'
                      className='grid grid-cols-1 gap-2.5 @xl:grid-cols-3'
                    >
                      {SERVICE_MODES.map((m) => {
                        const on = field.state.value.includes(m);
                        return (
                          <button
                            key={m}
                            type='button'
                            role='checkbox'
                            aria-checked={on}
                            onClick={() =>
                              field.handleChange(
                                on
                                  ? field.state.value.filter((x) => x !== m)
                                  : [...field.state.value, m]
                              )
                            }
                            className={cn(
                              'flex items-start gap-3 rounded-xl border-[1.5px] p-3 text-left transition-colors',
                              on ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60',
                              invalid && !on && 'border-destructive/50'
                            )}
                          >
                            <span
                              className={cn(
                                'mt-px grid size-5 shrink-0 place-items-center rounded-[7px] border-[1.5px]',
                                on
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-input bg-card'
                              )}
                            >
                              {on && <Icons.check className='size-3.5 stroke-[3]' />}
                            </span>
                            <span className='min-w-0'>
                              <span className='block text-sm leading-5 font-semibold'>
                                {MODE_SHORT[m]}
                              </span>
                              <span className='text-muted-foreground mt-0.5 block text-xs leading-snug'>
                                {MODE_HINT[m]}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {invalid && (
                      <div className='mt-2'>
                        <FieldError errors={field.state.meta.errors} />
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <form.AppField name='address' children={(f) => <f.TextField label='Alamat' />} />
            <form.AppField
              name='mapsUrl'
              listeners={{
                onChange: ({ value }) => {
                  const c = parseMapsCoords(value);
                  if (!c) return;
                  form.setFieldValue('lat', c.lat);
                  form.setFieldValue('lng', c.lng);
                }
              }}
              children={(f) => (
                <f.TextField
                  label='Tempel tautan Google Maps'
                  hint='koordinat terisi otomatis'
                  placeholder='https://maps.google.com/...'
                  description={
                    f.state.value && !parseMapsCoords(f.state.value)
                      ? 'Koordinat tidak terbaca dari tautan ini (tautan pendek tidak memuatnya). Isi lintang dan bujur sendiri.'
                      : undefined
                  }
                />
              )}
            />
            <div className={two}>
              <form.AppField
                name='lat'
                children={(f) => (
                  <f.TextField
                    label='Lintang (lat)'
                    type='number'
                    step='any'
                    placeholder='-0.9471'
                  />
                )}
              />
              <form.AppField
                name='lng'
                children={(f) => (
                  <f.TextField
                    label='Bujur (lng)'
                    type='number'
                    step='any'
                    placeholder='100.4172'
                  />
                )}
              />
            </div>
            <form.AppField
              name='pointIsPublic'
              children={(f) => (
                <f.SwitchField
                  label='Tampilkan titik di peta publik'
                  description='Matikan untuk usaha rumahan atau perorangan: warga hanya melihat kecamatan, titik tetap dipakai menghitung jarak.'
                />
              )}
            />
            <div className={two}>
              <form.AppField
                name='whatsapp'
                children={(f) => (
                  <f.TextField
                    label='WhatsApp'
                    hint='disimpan sebagai 62xxx'
                    placeholder='0812-3456-7890'
                  />
                )}
              />
              <form.AppField
                name='instagram'
                children={(f) => <f.TextField label='Instagram' placeholder='@namausaha' />}
              />
            </div>
            <div className={two}>
              <form.AppField name='phone' children={(f) => <f.TextField label='Telepon' />} />
              <form.AppField
                name='website'
                children={(f) => <f.TextField label='Website' placeholder='https://' />}
              />
            </div>
            <form.Field
              name='areaIds'
              mode='array'
              children={(field) => (
                <div>
                  <Lab hint='wilayah yang dijangkau bila datang ke pelanggan'>Area layanan</Lab>
                  <div className='flex flex-wrap gap-2'>
                    {areaOptions.map((o) => {
                      const on = field.state.value.includes(o.value);
                      return (
                        <Chip
                          key={o.value}
                          on={on}
                          onClick={() =>
                            field.handleChange(
                              on
                                ? field.state.value.filter((x) => x !== o.value)
                                : [...field.state.value, o.value]
                            )
                          }
                        >
                          {o.label}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}
            />
            <form.AppField
              name='serviceRadiusKm'
              children={(f) => (
                <f.TextField
                  label='Radius area layanan (km)'
                  type='number'
                  min={0.5}
                  max={200}
                  step='any'
                  placeholder='Mis. 10'
                  description='Untuk usaha yang datang ke pelanggan: dihitung dari titik usaha. Boleh dipakai bersama daftar wilayah di atas.'
                />
              )}
            />
          </Section>

          <Section
            title='Harga'
            description='Semua boleh kosong. Banyak vendor tidak mau mencantumkan harga.'
          >
            <div className={two}>
              <form.AppField
                name='priceMin'
                children={(f) => <f.TextField label='Harga minimum (Rp)' type='number' />}
              />
              <form.AppField
                name='priceMax'
                children={(f) => <f.TextField label='Harga maksimum (Rp)' type='number' />}
              />
              <form.AppField
                name='priceUnit'
                children={(f) => (
                  <f.SelectField
                    label='Satuan'
                    options={[{ value: '', label: '(tidak diisi)' }, ...PRICE_UNIT_OPTIONS]}
                    placeholder='Pilih satuan'
                  />
                )}
              />
              <form.AppField
                name='priceNote'
                children={(f) => (
                  <f.TextField
                    label='Catatan harga'
                    placeholder='Mis. belum termasuk ongkos kirim'
                  />
                )}
              />
            </div>
          </Section>

          {!isVendor && (
            <Section
              title='Status dan verifikasi'
              description='Hanya listing berstatus Terbit yang tampil ke warga dan chatbot.'
            >
              <div className={two}>
                <form.AppField
                  name='status'
                  children={(f) => (
                    <f.SelectField label='Status' required options={STATUS_OPTIONS} />
                  )}
                />
                <form.AppField
                  name='verificationLevel'
                  children={(f) => (
                    <f.SelectField label='Verifikasi' required options={VERIFICATION_OPTIONS} />
                  )}
                />
                <form.AppField
                  name='source'
                  children={(f) => (
                    <f.SelectField label='Sumber data' required options={SOURCE_OPTIONS} />
                  )}
                />
                <form.AppField
                  name='sourceUrl'
                  children={(f) => (
                    <f.TextField
                      label='Tautan sumber'
                      placeholder='Instagram, Google Maps, ...'
                      hint='dari mana data ini'
                    />
                  )}
                />
              </div>
              <form.Subscribe selector={(s) => s.values.status}>
                {(status) =>
                  status === 'rejected' ? (
                    <form.AppField
                      name='reviewNote'
                      children={(f) => (
                        <f.TextareaField label='Alasan penolakan' required rows={2} />
                      )}
                    />
                  ) : null
                }
              </form.Subscribe>
            </Section>
          )}
        </div>

        <aside className='min-w-0 space-y-3.5 min-[1181px]:sticky min-[1181px]:top-4'>
          <form.Subscribe selector={(s) => s.values}>
            {(v) => <SidePanels v={v} options={options} />}
          </form.Subscribe>

          <form.AppForm>
            <form.SubmitButton className='h-11 w-full'>
              {isVendor
                ? prevStatus === 'published' || prevStatus === 'pending_review'
                  ? 'Simpan perubahan'
                  : 'Kirim untuk review'
                : isEdit
                  ? 'Simpan perubahan'
                  : 'Simpan listing'}
            </form.SubmitButton>
          </form.AppForm>
          {isVendor ? (
            // Listing terbit tidak bisa dijadikan draf; selebihnya boleh disimpan dulu.
            prevStatus !== 'published' && (
              <form.Subscribe selector={(s) => s.isSubmitting}>
                {(submitting) => (
                  <Button
                    type='button'
                    variant='outline'
                    className='h-11 w-full'
                    disabled={submitting}
                    onClick={() => form.handleSubmit({ asDraft: true })}
                  >
                    Simpan sebagai draf
                  </Button>
                )}
              </form.Subscribe>
            )
          ) : (
            <form.Subscribe selector={(s) => [s.values.status, s.isSubmitting] as const}>
              {([status, submitting]) =>
                status !== 'draft' && (
                  <Button
                    type='button'
                    variant='outline'
                    className='h-11 w-full'
                    disabled={submitting}
                    onClick={() => form.handleSubmit({ asDraft: true })}
                  >
                    Simpan sebagai draf
                  </Button>
                )
              }
            </form.Subscribe>
          )}
        </aside>
      </div>
    </form>
  );
}
