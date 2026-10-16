'use client';
// Tanya jawab bebas satu usaha (PRD 8.8 lapis 2) + pertanyaan warga yang menunggu dijawab.
// Dipakai di /mitra/tanya-jawab dan di panel admin (props hanya listingId; server action mengizinkan admin
// atau mitra pemilik). Identitas penanya tidak pernah ditampilkan.
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppForm } from '@/lib/form';
import {
  answerQuestionMutation,
  deleteQaMutation,
  moveQaMutation,
  saveQaMutation
} from '../api/mutations';
import { qaOptions } from '../api/queries';
import type { QaItem } from '../api/types';
import { answerSchema, qaSchema } from '../schemas';

const card = 'bg-card rounded-xl p-4 shadow-sm';
const dateFmt = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const onErr = (e: Error) => toast.error(e.message);

function QaForm({
  listingId,
  item,
  onDone
}: {
  listingId: number;
  item: QaItem | null;
  onDone: () => void;
}) {
  const save = useMutation(saveQaMutation(listingId));
  const form = useAppForm({
    defaultValues: { question: item?.question ?? '', answer: item?.answer ?? '' },
    validators: { onSubmit: qaSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ id: item?.id ?? null, input: value });
        toast.success(item ? 'Tanya jawab disimpan' : 'Tanya jawab ditambahkan');
        form.reset();
        onDone();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
      }
    }
  });
  return (
    <form
      className='space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name='question'
        children={(f) => (
          <f.TextField label='Pertanyaan' required placeholder='Mis. Ada tempat parkir mobil?' />
        )}
      />
      <form.AppField
        name='answer'
        children={(f) => <f.TextareaField label='Jawaban' required rows={3} maxLength={2000} />}
      />
      <div className='grid grid-cols-2 gap-2'>
        {item ? (
          <Button type='button' variant='outline' onClick={onDone}>
            Batal
          </Button>
        ) : (
          <span />
        )}
        <form.AppForm>
          <form.SubmitButton>{item ? 'Simpan' : 'Tambah'}</form.SubmitButton>
        </form.AppForm>
      </div>
    </form>
  );
}

function PendingQuestion({
  listingId,
  item,
  onLink
}: {
  listingId: number;
  item: QaItem;
  onLink: (link: string | null) => void;
}) {
  const answer = useMutation(answerQuestionMutation(listingId));
  const remove = useMutation(deleteQaMutation(listingId));
  const form = useAppForm({
    defaultValues: { answer: '' },
    validators: { onSubmit: answerSchema },
    onSubmit: async ({ value }) => {
      try {
        const r = await answer.mutateAsync({ id: item.id, answer: value.answer });
        toast.success(
          r.notified === 'sent'
            ? 'Jawaban disimpan dan dikirim ke penanya lewat WhatsApp.'
            : 'Jawaban disimpan dan tampil di halaman usaha.'
        );
        onLink(r.link);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan jawaban');
      }
    }
  });
  return (
    <li className={card}>
      <p className='text-muted-foreground text-xs'>Ditanyakan {dateFmt.format(item.createdAt)}</p>
      <p className='mt-1 font-semibold'>{item.question}</p>
      <form
        className='mt-3 space-y-2'
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.AppField
          name='answer'
          children={(f) => <f.TextareaField label='Jawaban Anda' rows={2} maxLength={2000} />}
        />
        <div className='grid grid-cols-2 gap-2'>
          <Button
            type='button'
            variant='ghost'
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => toast.success('Pertanyaan diabaikan'),
                onError: (e) => toast.error(e.message)
              })
            }
          >
            Abaikan
          </Button>
          <form.AppForm>
            <form.SubmitButton>Kirim jawaban</form.SubmitButton>
          </form.AppForm>
        </div>
      </form>
    </li>
  );
}

export function QaEditor({ listingId }: { listingId: number }) {
  const { data, isPending, isError } = useQuery(qaOptions(listingId));
  const [editing, setEditing] = useState<number | null>(null);
  // Tautan cadangan untuk mengabari penanya: hanya dikirim server ke admin (memuat nomor warga).
  const [link, setLink] = useState<string | null>(null);
  const move = useMutation(moveQaMutation(listingId));
  const remove = useMutation(deleteQaMutation(listingId));

  if (isPending) return <Skeleton className='h-48 rounded-xl' />;
  if (isError || !data)
    return (
      <p role='alert' className='text-destructive text-sm'>
        Tanya jawab gagal dimuat. Muat ulang halaman.
      </p>
    );
  return (
    <div className='space-y-4'>
      <section aria-labelledby='qa-menunggu'>
        <h3 id='qa-menunggu' className='mb-2 px-1 font-semibold'>
          Pertanyaan warga menunggu jawaban ({data.pending.length})
        </h3>
        {link && (
          <div role='status' className={`${card} mb-2`}>
            <p className='text-sm'>Jawaban tersimpan. Kabari penanya dari nomor resmi Kamanga:</p>
            <a
              href={link}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4'
            >
              <Icons.whatsapp className='size-5' aria-hidden /> Kirim jawaban lewat WhatsApp
            </a>
          </div>
        )}
        {data.pending.length ? (
          <ul className='space-y-2'>
            {data.pending.map((q) => (
              <PendingQuestion key={q.id} listingId={listingId} item={q} onLink={setLink} />
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground px-1 text-sm'>Tidak ada pertanyaan yang menunggu.</p>
        )}
      </section>

      <section aria-labelledby='qa-tampil'>
        <h3 id='qa-tampil' className='mb-1 px-1 font-semibold'>
          Tanya jawab yang tampil ke warga
        </h3>
        <p className='text-muted-foreground mb-2 px-1 text-xs'>
          Dipakai Kamanga untuk menjawab pertanyaan warga tentang usaha Anda. Urutan teratas tampil
          lebih dulu.
        </p>
        {data.items.length ? (
          <ol className='space-y-2'>
            {data.items.map((q, i) => (
              <li key={q.id} className={card}>
                {editing === q.id ? (
                  <QaForm listingId={listingId} item={q} onDone={() => setEditing(null)} />
                ) : (
                  <>
                    <p className='font-semibold'>{q.question}</p>
                    <p className='mt-1 text-sm whitespace-pre-line'>{q.answer}</p>
                    <div className='mt-2 flex flex-wrap gap-1'>
                      <Button
                        variant='ghost'
                        size='icon-lg'
                        aria-label='Naikkan'
                        disabled={i === 0 || move.isPending}
                        onClick={() => move.mutate({ id: q.id, dir: -1 }, { onError: onErr })}
                      >
                        <Icons.chevronUp aria-hidden />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-lg'
                        aria-label='Turunkan'
                        disabled={i === data.items.length - 1 || move.isPending}
                        onClick={() => move.mutate({ id: q.id, dir: 1 }, { onError: onErr })}
                      >
                        <Icons.chevronDown aria-hidden />
                      </Button>
                      <Button variant='ghost' className='h-11' onClick={() => setEditing(q.id)}>
                        <Icons.edit aria-hidden /> Ubah
                      </Button>
                      <Button
                        variant='ghost'
                        className='text-destructive h-11'
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(q.id, {
                            onSuccess: () => toast.success('Tanya jawab dihapus'),
                            onError: onErr
                          })
                        }
                      >
                        <Icons.trash aria-hidden /> Hapus
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className='text-muted-foreground px-1 text-sm'>Belum ada tanya jawab.</p>
        )}
      </section>

      <section className={card} aria-labelledby='qa-tambah'>
        <h3 id='qa-tambah' className='mb-3 font-semibold'>
          Tambah tanya jawab
        </h3>
        <QaForm listingId={listingId} item={null} onDone={() => undefined} />
      </section>
    </div>
  );
}
