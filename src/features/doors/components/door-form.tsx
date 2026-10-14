'use client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { createDoorMutation, updateDoorMutation } from '../api/mutations';
import type { DoorDetail } from '../api/types';
import {
  DOOR_KIND_HINTS,
  DOOR_KIND_LABELS,
  DOOR_KINDS,
  DOOR_STATUS_HINTS,
  DOOR_STATUS_LABELS,
  DOOR_STATUSES,
  ICON_KEYS,
  doorFormSchema,
  emptyDoorForm,
  type DoorFormValues
} from '../schemas/door';
import { DoorIcon } from './door-list';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>{title}</h3>
      <FieldGroup className='mt-4 gap-4'>{children}</FieldGroup>
    </section>
  );
}

const Lab = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <div className='mb-2 text-[0.8125rem] font-semibold'>
    {children}
    {hint && <small className='text-muted-foreground ml-1.5 font-normal'>{hint}</small>}
  </div>
);

/** Semua kunci `Icons` sebagai tombol; cari lewat nama kunci (bahasa Inggris, mis. "ball", "bus"). */
function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const keys = ICON_KEYS.filter((k) => k.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className='space-y-2.5'>
      <Input
        type='search'
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder='Cari ikon (bahasa Inggris), mis. ball, bus, tool'
        aria-label='Cari ikon'
      />
      <div
        role='radiogroup'
        aria-label='Ikon pintu'
        className='grid max-h-72 grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 overflow-y-auto rounded-lg border p-2'
      >
        {keys.map((k) => {
          const I = Icons[k];
          const on = value === k;
          return (
            <button
              key={k}
              type='button'
              role='radio'
              aria-checked={on}
              aria-label={k}
              title={k}
              onClick={() => onChange(k)}
              className={cn(
                'grid size-11 place-items-center rounded-lg border transition-colors',
                on ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <I className='size-5' aria-hidden='true' />
            </button>
          );
        })}
        {keys.length === 0 && (
          <p className='text-muted-foreground col-span-full p-2 text-sm'>Tidak ada ikon cocok.</p>
        )}
      </div>
    </div>
  );
}

/** Pratinjau tombol pintu di beranda. */
function Preview({ v }: { v: DoorFormValues }) {
  return (
    <div className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>Pratinjau di beranda</h3>
      <div className='mt-4 flex justify-center'>
        {v.status === 'hidden' ? (
          <p className='text-muted-foreground text-center text-sm'>
            Pintu tersembunyi tidak tampil di beranda.
          </p>
        ) : (
          <div className='relative flex w-36 flex-col items-center gap-2 rounded-2xl border p-4 text-center'>
            {v.status === 'soon' && (
              <span className='absolute top-2 right-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700 dark:text-amber-300'>
                Segera
              </span>
            )}
            <span className='bg-primary/10 text-primary grid size-12 place-items-center rounded-xl'>
              <DoorIcon icon={v.icon || null} className='size-6' />
            </span>
            <span className='text-sm font-semibold'>{v.name.trim() || 'Nama pintu'}</span>
          </div>
        )}
      </div>
      {v.rotatingText.trim() && (
        <p className='text-muted-foreground mt-3 text-center text-xs'>
          Kamanga hari ko? <i>{v.rotatingText.trim()}</i>
        </p>
      )}
    </div>
  );
}

export default function DoorForm({ detail }: { detail?: DoorDetail }) {
  const router = useRouter();
  const create = useMutation(createDoorMutation);
  const update = useMutation(updateDoorMutation);

  const form = useAppForm({
    defaultValues: detail?.values ?? emptyDoorForm,
    validators: { onSubmit: doorFormSchema },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value }) => {
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values: value });
        else await create.mutateAsync(value);
        toast.success(detail ? 'Pintu disimpan' : 'Pintu dibuat');
        router.push('/dashboard/doors');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan pintu');
      }
    }
  });

  return (
    <form
      className='w-full max-w-5xl pb-8'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div className='grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]'>
        <div className='min-w-0 space-y-4'>
          <Section title='Identitas'>
            <form.AppField
              name='name'
              children={(f) => (
                <f.TextField
                  label='Nama pintu'
                  required
                  maxLength={40}
                  placeholder='Mis. Ka main'
                  autoFocus={!detail}
                />
              )}
            />
            {detail ? (
              <p className='text-muted-foreground text-xs'>
                Alamat halaman: /pintu/{detail.values.slug} (tetap, agar tautan lama tidak rusak).
              </p>
            ) : (
              <form.AppField
                name='slug'
                children={(f) => (
                  <f.TextField
                    label='Alamat halaman (slug)'
                    hint='otomatis dari nama bila kosong'
                    placeholder='ka-main'
                    description='Tidak bisa diubah setelah pintu dibuat.'
                  />
                )}
              />
            )}
            <form.AppField
              name='description'
              children={(f) => (
                <f.TextareaField
                  label='Keterangan'
                  rows={2}
                  maxLength={200}
                  showCount
                  placeholder='Mis. Olahraga dan hiburan: lapangan, billiard, karaoke, gym.'
                />
              )}
            />
            <form.AppField
              name='rotatingText'
              children={(f) => (
                <f.TextField
                  label='Teks berganti di beranda'
                  maxLength={60}
                  placeholder='ka main…'
                  description='Muncul bergantian di bawah judul "Kamanga hari ko?".'
                />
              )}
            />
            <form.AppField
              name='aliases'
              mode='array'
              children={(f) => (
                <f.TagsField
                  label='Sebutan lain'
                  placeholder='Ketik lalu Enter. Mis. sewa lapangan'
                  description='Kata warga yang mengarah ke pintu ini.'
                />
              )}
            />
          </Section>

          <Section title='Ikon'>
            <form.Field
              name='icon'
              children={(field) => (
                <div>
                  <IconPicker value={field.state.value} onChange={field.handleChange} />
                  {field.state.meta.errors.length > 0 && (
                    <div className='mt-2'>
                      <FieldError errors={field.state.meta.errors} />
                    </div>
                  )}
                </div>
              )}
            />
          </Section>

          <Section title='Tampilan'>
            <form.Field
              name='status'
              children={(field) => (
                <div>
                  <Lab>Status tampil</Lab>
                  <div
                    role='radiogroup'
                    aria-label='Status tampil'
                    className='grid gap-2 sm:grid-cols-3'
                  >
                    {DOOR_STATUSES.map((s) => {
                      const on = field.state.value === s;
                      return (
                        <button
                          key={s}
                          type='button'
                          role='radio'
                          aria-checked={on}
                          onClick={() => field.handleChange(s)}
                          className={cn(
                            'rounded-xl border-[1.5px] p-3 text-left transition-colors',
                            on ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/60'
                          )}
                        >
                          <span className='block text-sm font-semibold'>
                            {DOOR_STATUS_LABELS[s]}
                          </span>
                          <span className='text-muted-foreground mt-0.5 block text-xs leading-snug'>
                            {DOOR_STATUS_HINTS[s]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            />
            <form.AppField
              name='kind'
              children={(f) => (
                <f.SelectField
                  label='Jenis pintu'
                  options={DOOR_KINDS.map((k) => ({
                    value: k,
                    label: `${DOOR_KIND_LABELS[k]} — ${DOOR_KIND_HINTS[k]}`
                  }))}
                />
              )}
            />
          </Section>
        </div>

        <aside className='space-y-4 lg:sticky lg:top-4'>
          <form.Subscribe selector={(s) => s.values}>{(v) => <Preview v={v} />}</form.Subscribe>
          {detail && (
            <p className='text-muted-foreground text-xs'>
              {detail.categoryCount
                ? `${detail.categoryCount} kategori memakai pintu ini.`
                : 'Belum ada kategori. Pilih pintu ini di formulir kategori.'}
            </p>
          )}
          <div className='flex flex-col gap-2'>
            <form.AppForm>
              <form.SubmitButton className='h-11 w-full'>
                {detail ? 'Simpan perubahan' : 'Buat pintu'}
              </form.SubmitButton>
            </form.AppForm>
            <Link
              href='/dashboard/doors'
              className={buttonVariants({ variant: 'ghost', className: 'h-11 w-full' })}
            >
              Batal
            </Link>
          </div>
        </aside>
      </div>
    </form>
  );
}
