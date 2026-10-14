'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { FieldGroup } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { useAppForm } from '@/lib/form';
import { saveSettingsMutation } from '../api/mutations';
import { settingsQueryOptions } from '../api/queries';
import type { EnvStatus } from '../api/types';
import { EDITABLE_TEMPLATES, TEMPLATE_LABELS, WA_TEXTS, metaParamKeys } from '../lib/templates';
import { settingsFormSchema } from '../schemas/settings';

const panel = 'bg-card rounded-xl p-5 shadow-sm';
const num = (n: number) => n.toLocaleString('id-ID');

function Section({
  title,
  description,
  children
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={panel}>
      <h3 className='text-[1.0625rem] font-semibold'>{title}</h3>
      {description && <p className='text-muted-foreground mt-1 text-[0.8125rem]'>{description}</p>}
      <FieldGroup className='mt-4 gap-4'>{children}</FieldGroup>
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-baseline justify-between gap-4 py-1.5 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='text-right font-medium tabular-nums'>{value}</dd>
    </div>
  );
}

/** Nilai dari env server: hanya ditampilkan, diubah lewat berkas .env di server. */
function EnvPanels({ env }: { env: EnvStatus }) {
  return (
    <>
      <section className={panel}>
        <div className='flex items-center justify-between gap-2'>
          <h3 className='text-[1.0625rem] font-semibold'>WhatsApp</h3>
          {env.waMode === 'api' ? (
            <Pill tone='ok'>API resmi aktif</Pill>
          ) : (
            <Pill tone='warn'>Mode cadangan</Pill>
          )}
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {env.waMode === 'api'
            ? 'Pesan dikirim otomatis dari nomor resmi Kamanga lewat WhatsApp Business API.'
            : 'Pesan dibuat sebagai tautan wa.me. Pesanan baru diteruskan tim dari menu Pesanan.'}
        </p>
        <ul className='mt-3 space-y-1 text-sm'>
          {env.waEnv.map((e) => (
            <li key={e.name} className='flex items-center justify-between gap-2'>
              <code className='text-xs'>{e.name}</code>
              {e.set ? (
                <span className='inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300'>
                  <Icons.check className='size-3.5' /> terisi
                </span>
              ) : (
                <span className='text-muted-foreground text-xs'>kosong</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={panel}>
        <h3 className='text-[1.0625rem] font-semibold'>Batas chat dan rem biaya AI</h3>
        <p className='text-muted-foreground mt-1 text-xs'>
          Diatur lewat env server, tidak dari sini.
        </p>
        <dl className='mt-2 divide-y'>
          <Info label='Pesan per sesi per hari' value={num(env.chat.perSessionPerDay)} />
          <Info label='Pesan per IP per hari' value={num(env.chat.perIpPerDay)} />
          <Info label='Panjang pesan maksimal' value={`${num(env.chat.maxChars)} karakter`} />
          <Info
            label='Model AI'
            value={
              env.llm.provider === 'none'
                ? 'tidak dipakai'
                : `${env.llm.provider}${env.llm.hasKey ? '' : ' (kunci belum diisi)'}`
            }
          />
          {env.llm.provider !== 'none' && (
            <>
              <Info label='Model murah' value={env.llm.modelCheap ?? '-'} />
              <Info label='Model kuat' value={env.llm.modelStrong ?? '-'} />
            </>
          )}
          <Info label='Batas token per hari' value={num(env.llm.dailyTokenLimit)} />
          <Info
            label='Rem biaya per hari'
            value={
              env.llm.dailyCostLimitUsd === null
                ? 'tidak dibatasi'
                : `US$${env.llm.dailyCostLimitUsd.toLocaleString('id-ID')}`
            }
          />
        </dl>
      </section>
    </>
  );
}

export function SettingsForm() {
  const { data } = useSuspenseQuery(settingsQueryOptions());
  const save = useMutation(saveSettingsMutation);

  const form = useAppForm({
    defaultValues: data.values,
    validators: { onSubmit: settingsFormSchema },
    onSubmitInvalid: () => toast.error('Ada isian yang belum benar. Periksa yang bertanda merah.'),
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync(value);
        toast.success('Pengaturan disimpan');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan');
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
      <div className='grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]'>
        <div className='min-w-0 space-y-4'>
          <Section
            title='Pesanan'
            description='Bawaan untuk semua kategori. Batas waktu menjawab bisa diatur lain per kategori.'
          >
            <div className='grid gap-4 sm:grid-cols-2'>
              <form.AppField
                name='defaultResponseMinutes'
                children={(f) => (
                  <f.TextField
                    label='Batas waktu menjawab (menit)'
                    type='number'
                    min={5}
                    max={1440}
                    required
                    description='Lewat batas ini pesanan kedaluwarsa dan warga ditawari tempat lain.'
                  />
                )}
              />
              <form.AppField
                name='reminderMinutesBefore'
                children={(f) => (
                  <f.TextField
                    label='Pengingat ke warga (menit sebelum jadwal)'
                    type='number'
                    min={15}
                    max={2880}
                    required
                    description='Mis. 120 = dua jam sebelum jadwal.'
                  />
                )}
              />
            </div>
          </Section>

          <Section
            title='Teks pesan WhatsApp'
            description={
              <>
                Dipakai di mode cadangan (tautan wa.me). Kosongkan untuk memakai teks bawaan.
                Penanda seperti <code>{'{code}'}</code> diganti isi pesanan; <code>{'{link}'}</code>{' '}
                dan <code>{'{code}'}</code> wajib tetap ada. Di mode API, pesan memakai template
                yang didaftarkan ke Meta.
              </>
            }
          >
            {EDITABLE_TEMPLATES.map((t) => (
              <form.AppField
                key={t}
                name={`waTemplates.${t}`}
                children={(f) => (
                  <div className='space-y-1.5'>
                    <f.TextareaField
                      label={TEMPLATE_LABELS[t]}
                      rows={4}
                      maxLength={1000}
                      placeholder={WA_TEXTS[t]}
                      description={`Penanda: ${metaParamKeys(t)
                        .filter((k, i, a) => a.indexOf(k) === i)
                        .map((k) => `{${k}}`)
                        .join(' ')}`}
                    />
                    {!f.state.value && (
                      <button
                        type='button'
                        onClick={() => f.handleChange(WA_TEXTS[t])}
                        className='text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline'
                      >
                        Ubah mulai dari teks bawaan
                      </button>
                    )}
                  </div>
                )}
              />
            ))}
          </Section>
        </div>

        <aside className='space-y-4 lg:sticky lg:top-4'>
          <form.AppForm>
            <form.SubmitButton className='h-11 w-full'>Simpan pengaturan</form.SubmitButton>
          </form.AppForm>
          <EnvPanels env={data.env} />
        </aside>
      </div>
    </form>
  );
}
