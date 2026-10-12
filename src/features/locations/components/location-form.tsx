'use client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Chip } from '@/components/forms/chip';
import { buttonVariants } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { parseMapsCoords } from '@/features/listings/lib/format';
import { useAppForm } from '@/lib/form';
import { createLocationMutation, updateLocationMutation } from '../api/mutations';
import type { LocationDetail, LocationOption } from '../api/types';
import { LEVEL_LABELS, LEVEL_OPTIONS, type Level } from '../constants';
import { LEVEL_RANK } from '../lib/csv';
import {
  emptyLocationForm,
  locationFormSchema,
  type LocationFormValues
} from '../schemas/location';

const two = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2';

const LEVEL_HINT: Record<Level, string> = {
  province: 'Provinsi, tidak punya induk.',
  city: 'Kota atau kabupaten, induknya provinsi.',
  district: 'Kecamatan, induknya kota atau kabupaten.',
  village: 'Nagari atau kelurahan, induknya kecamatan.',
  landmark: 'Tempat yang dikenal warga, mis. pasar, kampus, atau pantai.'
};

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

/** Ringkasan langsung: bagaimana chatbot akan mengenali lokasi ini. */
function Preview({ v, options }: { v: LocationFormValues; options: LocationOption[] }) {
  const parent = options.find((o) => String(o.id) === v.parentId);
  const path = parent ? [parent.name, parent.path].filter(Boolean).join(', ') : null;
  const aliases = v.aliases.map((a) => a.trim()).filter(Boolean);
  const hasCoords = v.lat !== undefined && v.lng !== undefined;
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>Seperti dikenali chatbot</h3>
      <div className='mt-3.5 rounded-2xl border p-3.5'>
        <h4
          className={
            v.name.trim()
              ? 'text-[0.9375rem] font-semibold'
              : 'text-muted-foreground text-[0.9375rem] font-semibold'
          }
        >
          {v.name.trim() || 'Nama lokasi'}
        </h4>
        <div className='mt-1.5 flex flex-wrap gap-1.5'>
          <span className='bg-secondary text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-semibold'>
            {LEVEL_LABELS[v.level]}
          </span>
        </div>
        <p className='text-muted-foreground mt-2.5 text-[0.8125rem]'>
          {path ?? (v.level === 'province' ? 'Tingkat tertinggi' : 'Belum punya induk')}
        </p>
        {aliases.length > 0 && (
          <p className='mt-1.5 text-[0.8125rem]'>
            <span className='text-muted-foreground'>Juga dikenali: </span>
            {aliases.join(', ')}
          </p>
        )}
      </div>
      <p className='text-muted-foreground mt-3 text-xs'>
        {hasCoords
          ? 'Punya koordinat: bisa dipakai untuk mengurutkan hasil terdekat.'
          : 'Tanpa koordinat: hasil tidak bisa diurutkan menurut jarak dari lokasi ini.'}
      </p>
    </section>
  );
}

export default function LocationForm({
  options,
  detail,
  pageTitle
}: {
  options: LocationOption[];
  detail?: LocationDetail;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!detail;
  const create = useMutation(createLocationMutation);
  const update = useMutation(updateLocationMutation);

  const form = useAppForm({
    defaultValues: detail?.values ?? emptyLocationForm,
    validators: { onSubmit: locationFormSchema },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value }) => {
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values: value });
        else await create.mutateAsync(value);
        toast.success(isEdit ? 'Lokasi disimpan' : 'Lokasi dibuat');
        router.push('/dashboard/locations');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan lokasi');
      }
    }
  });

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
          {detail
            ? `Dipakai oleh ${detail.listingCount} listing, punya ${detail.childCount} lokasi di bawahnya.`
            : 'Lokasi dipakai chatbot untuk mengenali tempat yang disebut warga, mis. "Lubeg" untuk Lubuk Begalung.'}
        </p>
      </div>

      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <div className='min-w-0 space-y-3.5'>
          <Section title='Identitas'>
            <div className={two}>
              <form.AppField
                name='name'
                children={(f) => (
                  <f.TextField
                    label='Nama resmi'
                    required
                    placeholder='Mis. Lubuk Begalung'
                    autoFocus={!isEdit}
                    maxLength={100}
                  />
                )}
              />
              <form.AppField
                name='slug'
                children={(f) => (
                  <f.TextField label='Slug' hint='otomatis' placeholder='lubuk-begalung' />
                )}
              />
            </div>

            <form.Field
              name='level'
              children={(field) => (
                <div>
                  <div className='mb-1.5 text-[0.8125rem] leading-normal font-semibold'>
                    Tingkat *
                    <small className='text-muted-foreground ml-1.5 font-normal'>
                      {LEVEL_HINT[field.state.value]}
                    </small>
                  </div>
                  <div role='group' aria-label='Tingkat' className='flex flex-wrap gap-2'>
                    {LEVEL_OPTIONS.map((o) => (
                      <Chip
                        key={o.value}
                        on={field.state.value === o.value}
                        onClick={() => {
                          field.handleChange(o.value);
                          // Induk harus dari tingkat yang lebih tinggi; lepas bila tidak lagi cocok.
                          const cur = options.find(
                            (x) => String(x.id) === form.getFieldValue('parentId')
                          );
                          if (
                            o.value === 'province' ||
                            (cur && LEVEL_RANK[cur.level] >= LEVEL_RANK[o.value])
                          )
                            form.setFieldValue('parentId', '');
                        }}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            />

            <form.Subscribe selector={(s) => s.values.level}>
              {(level) => {
                if (level === 'province') return null;
                // Induk hanya boleh berasal dari tingkat yang lebih tinggi, dan bukan lokasi ini sendiri.
                const parents = options
                  .filter((o) => LEVEL_RANK[o.level] < LEVEL_RANK[level] && o.id !== detail?.id)
                  .map((o) => ({
                    value: String(o.id),
                    label: o.name,
                    description: [LEVEL_LABELS[o.level], o.path].filter(Boolean).join(' · ')
                  }));
                return (
                  <form.AppField
                    name='parentId'
                    children={(f) => (
                      <f.ComboboxField
                        label='Induk'
                        options={[{ value: '', label: '(tanpa induk)' }, ...parents]}
                        placeholder='Pilih induk'
                        searchPlaceholder='Cari nama wilayah...'
                      />
                    )}
                  />
                );
              }}
            </form.Subscribe>
          </Section>

          <Section
            title='Sebutan dan koordinat'
            description='Sebutan lain dan ejaan populer dipakai chatbot untuk mengenali lokasi, mis. "Lubeg" atau "Bukiktinggi".'
          >
            <form.AppField
              name='aliases'
              mode='array'
              children={(f) => (
                <f.TagsField label='Sebutan lain' placeholder='Ketik lalu Enter. Mis. Lubeg' />
              )}
            />
            <MapsLink
              onCoords={(c) => {
                form.setFieldValue('lat', c.lat);
                form.setFieldValue('lng', c.lng);
              }}
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
          </Section>
        </div>

        <aside className='min-w-0 space-y-3.5 lg:sticky lg:top-4'>
          <form.Subscribe selector={(s) => s.values}>
            {(v) => <Preview v={v} options={options} />}
          </form.Subscribe>
          <form.AppForm>
            <form.SubmitButton className='h-11 w-full'>
              {isEdit ? 'Simpan perubahan' : 'Buat lokasi'}
            </form.SubmitButton>
          </form.AppForm>
          <Link
            href='/dashboard/locations'
            className={buttonVariants({ variant: 'ghost', className: 'h-11 w-full' })}
          >
            Batal
          </Link>
        </aside>
      </div>
    </form>
  );
}

/** Tempel tautan Google Maps; koordinat diisi otomatis. Tidak disimpan, hanya alat bantu. */
function MapsLink({ onCoords }: { onCoords: (c: { lat: number; lng: number }) => void }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <label htmlFor='maps-link' className='text-[0.8125rem] leading-normal font-semibold'>
        Tempel tautan Google Maps
        <small className='text-muted-foreground ml-1.5 font-normal'>
          koordinat terisi otomatis
        </small>
      </label>
      <Input
        id='maps-link'
        type='url'
        placeholder='https://maps.google.com/...'
        onChange={(e) => {
          const c = parseMapsCoords(e.target.value);
          if (c) onCoords(c);
        }}
      />
    </div>
  );
}
