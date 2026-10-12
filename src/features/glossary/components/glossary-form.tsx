'use client';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { buttonVariants } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { norm } from '@/lib/directory/norm';
import { useAppForm } from '@/lib/form';
import { createGlossaryMutation, updateGlossaryMutation } from '../api/mutations';
import type { GlossaryDetail, GlossaryFormValues } from '../api/types';
import { emptyGlossaryForm, glossaryFormSchema } from '../schemas/glossary';

/** Ringkasan langsung: bagaimana chatbot membaca kata ini. */
function Preview({ v }: { v: GlossaryFormValues }) {
  const term = norm(v.term);
  return (
    <section className='bg-card rounded-xl p-5 shadow-sm'>
      <h3 className='text-[1.0625rem] font-semibold'>Seperti dipahami chatbot</h3>
      <dl className='mt-3.5 space-y-3 text-sm'>
        <div>
          <dt className='text-muted-foreground mb-0.5 text-xs'>Warga menulis</dt>
          <dd className='font-medium'>
            {term ? `“${term}”` : <span className='text-muted-foreground'>Kata</span>}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground mb-0.5 text-xs'>Dibaca sebagai</dt>
          <dd>
            {v.meaning.trim() || (
              <span className='text-muted-foreground'>Arti dalam bahasa Indonesia</span>
            )}
          </dd>
        </div>
      </dl>
      <p className='text-muted-foreground mt-3 text-xs'>
        {v.isChecked
          ? 'Dipakai chatbot untuk menerjemahkan kata ini sebelum mencari.'
          : 'Belum dicek, jadi belum dipakai chatbot.'}
      </p>
    </section>
  );
}

export default function GlossaryForm({
  detail,
  pageTitle
}: {
  detail?: GlossaryDetail;
  pageTitle: string;
}) {
  const router = useRouter();
  const isEdit = !!detail;
  const create = useMutation(createGlossaryMutation);
  const update = useMutation(updateGlossaryMutation);

  const form = useAppForm({
    defaultValues: detail?.values ?? emptyGlossaryForm,
    validators: { onSubmit: glossaryFormSchema },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value }) => {
      try {
        if (detail) await update.mutateAsync({ id: detail.id, values: value });
        else await create.mutateAsync(value);
        toast.success(isEdit ? 'Kata disimpan' : 'Kata ditambahkan');
        router.push('/dashboard/glossary');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan kata');
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
          Kata dan artinya, untuk melatih chatbot memahami bahasa sehari-hari dan Minang. Sebutan
          untuk kategori, kebutuhan, dan lokasi diisi di menu masing-masing.
        </p>
      </div>

      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <div className='min-w-0 space-y-3.5'>
          <section className='bg-card rounded-xl p-5 shadow-sm'>
            <h3 className='text-[1.0625rem] font-semibold'>Kata dan arti</h3>
            <FieldGroup className='mt-4 gap-3.5'>
              <div className='grid grid-cols-1 gap-3.5 sm:grid-cols-2'>
                <form.AppField
                  name='term'
                  children={(f) => (
                    <f.TextField
                      label='Kata'
                      required
                      placeholder='Mis. baralek'
                      autoFocus={!isEdit}
                      maxLength={60}
                    />
                  )}
                />
                <form.AppField
                  name='meaning'
                  children={(f) => (
                    <f.TextField
                      label='Artinya'
                      required
                      placeholder='Mis. pesta pernikahan'
                      maxLength={200}
                      hint='bahasa Indonesia'
                    />
                  )}
                />
              </div>
              <form.AppField
                name='notes'
                children={(f) => (
                  <f.TextareaField
                    label='Catatan (opsional)'
                    rows={2}
                    maxLength={300}
                    placeholder='Mis. dipakai di Padang dan sekitarnya. Tidak tampil ke warga.'
                  />
                )}
              />
            </FieldGroup>
          </section>
        </div>

        <aside className='min-w-0 space-y-3.5 lg:sticky lg:top-4'>
          <form.Subscribe selector={(s) => s.values}>{(v) => <Preview v={v} />}</form.Subscribe>

          <form.Field
            name='isChecked'
            children={(f) => (
              <div className='bg-card flex items-start justify-between gap-4 rounded-xl p-5 shadow-sm'>
                <label htmlFor='is-checked' className='cursor-pointer'>
                  <span className='block text-sm font-medium'>Sudah dicek penutur asli</span>
                  <span className='text-muted-foreground mt-0.5 block text-xs'>
                    Hanya kata yang sudah dicek dipakai chatbot.
                  </span>
                </label>
                <Switch id='is-checked' checked={f.state.value} onCheckedChange={f.handleChange} />
              </div>
            )}
          />

          <form.AppForm>
            <form.SubmitButton className='h-11 w-full'>
              {isEdit ? 'Simpan perubahan' : 'Tambah kata'}
            </form.SubmitButton>
          </form.AppForm>
          <Link
            href='/dashboard/glossary'
            className={buttonVariants({ variant: 'ghost', className: 'h-11 w-full' })}
          >
            Batal
          </Link>
        </aside>
      </div>
    </form>
  );
}
