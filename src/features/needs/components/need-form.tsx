'use client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CategoryPicker } from '@/components/forms/category-picker';
import { buttonVariants } from '@/components/ui/button';
import { FieldError, FieldGroup } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useAppForm } from '@/lib/form';
import { createNeedMutation, updateNeedMutation } from '../api/mutations';
import type { NeedDetail, NeedFormValues, NeedOptions } from '../api/types';
import { emptyNeedForm, needFormSchema } from '../schemas/need';

const two = 'grid grid-cols-1 gap-3.5 sm:grid-cols-2';

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

/** Ringkasan langsung: apa yang dilakukan chatbot saat warga menyebut kebutuhan ini. */
function Preview({ v, options }: { v: NeedFormValues; options: NeedOptions }) {
  const aliases = v.aliases.map((a) => a.trim()).filter(Boolean);
  const names = v.categoryIds
    .map((id) => options.categories.find((c) => String(c.id) === id)?.name)
    .filter(Boolean) as string[];
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>Seperti dipahami chatbot</h3>
      <dl className='mt-3.5 space-y-3 text-sm'>
        <div>
          <dt className='text-muted-foreground mb-0.5 text-xs'>Warga menyebut</dt>
          <dd className='font-medium'>
            {[v.name.trim(), ...aliases].filter(Boolean).join(', ') || (
              <span className='text-muted-foreground'>Nama kebutuhan</span>
            )}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground mb-0.5 text-xs'>Lalu mencarikan kategori</dt>
          <dd>
            {names.length ? (
              <ul className='space-y-0.5'>
                {names.map((n, i) => (
                  <li key={n}>
                    <span className='text-muted-foreground mr-1.5'>{i + 1}.</span>
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <span className='text-muted-foreground'>Belum memilih kategori</span>
            )}
          </dd>
        </div>
      </dl>
      {!v.isActive && (
        <p className='text-muted-foreground mt-3 text-xs'>
          Nonaktif: chatbot mengabaikan kebutuhan ini.
        </p>
      )}
    </section>
  );
}

export default function NeedForm({
  options,
  detail,
  pageTitle
}: {
  options: NeedOptions;
  detail?: NeedDetail;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!detail;
  const create = useMutation(createNeedMutation);
  const update = useMutation(updateNeedMutation);

  const form = useAppForm({
    defaultValues: detail?.values ?? emptyNeedForm,
    validators: { onSubmit: needFormSchema },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value }) => {
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values: value });
        else await create.mutateAsync(value);
        toast.success(isEdit ? 'Kebutuhan disimpan' : 'Kebutuhan dibuat');
        router.push('/dashboard/needs');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kebutuhan');
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
          Kebutuhan adalah situasi warga, mis. Pesta Pernikahan atau AC Rusak. Satu kebutuhan bisa
          dilayani beberapa kategori.
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
                    label='Nama kebutuhan'
                    required
                    placeholder='Mis. Pesta Pernikahan'
                    autoFocus={!isEdit}
                    maxLength={80}
                  />
                )}
              />
              <form.AppField
                name='slug'
                children={(f) => (
                  <f.TextField label='Slug' hint='otomatis' placeholder='pesta-pernikahan' />
                )}
              />
            </div>
            <form.AppField
              name='aliases'
              mode='array'
              children={(f) => (
                <f.TagsField
                  label='Sebutan lain'
                  placeholder='Ketik lalu Enter. Mis. baralek'
                  description='Kata lain yang dipakai warga untuk kebutuhan ini, termasuk bahasa Minang.'
                />
              )}
            />
            <form.AppField
              name='description'
              children={(f) => (
                <f.TextareaField
                  label='Catatan untuk tim (opsional)'
                  rows={2}
                  maxLength={500}
                  placeholder='Tidak tampil ke warga'
                />
              )}
            />
          </Section>

          <Section
            title='Kategori terkait'
            description='Kategori yang dicarikan saat warga menyebut kebutuhan ini. Urutan klik menjadi urutan prioritas.'
          >
            <form.Field
              name='categoryIds'
              mode='array'
              children={(field) => {
                const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <div>
                    <CategoryPicker
                      categories={options.categories}
                      invalid={invalid}
                      isOn={(id) => field.state.value.includes(String(id))}
                      onPick={(id) =>
                        field.handleChange(
                          field.state.value.includes(String(id))
                            ? field.state.value.filter((x) => x !== String(id))
                            : [...field.state.value, String(id)]
                        )
                      }
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
          </Section>
        </div>

        <aside className='min-w-0 space-y-3.5 lg:sticky lg:top-4'>
          <form.Subscribe selector={(s) => s.values}>
            {(v) => <Preview v={v} options={options} />}
          </form.Subscribe>

          <form.Field
            name='isActive'
            children={(f) => (
              <div className='bg-card flex items-start justify-between gap-4 rounded-xl p-5 shadow-sm'>
                <label htmlFor='need-active' className='cursor-pointer'>
                  <span className='block text-sm font-medium'>Aktif</span>
                  <span className='text-muted-foreground mt-0.5 block text-xs'>
                    Kebutuhan nonaktif tidak dipakai chatbot.
                  </span>
                </label>
                <Switch id='need-active' checked={f.state.value} onCheckedChange={f.handleChange} />
              </div>
            )}
          />

          <form.AppForm>
            <form.SubmitButton className='h-11 w-full'>
              {isEdit ? 'Simpan perubahan' : 'Buat kebutuhan'}
            </form.SubmitButton>
          </form.AppForm>
          <Link
            href='/dashboard/needs'
            className={buttonVariants({ variant: 'ghost', className: 'h-11 w-full' })}
          >
            Batal
          </Link>
        </aside>
      </div>
    </form>
  );
}
