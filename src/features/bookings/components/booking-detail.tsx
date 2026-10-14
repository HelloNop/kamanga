'use client';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { formatDuration, formatRupiah } from '@/features/listings/lib/format';
import type { WaSendResult } from '@/lib/engines/contracts';
import { useAppForm } from '@/lib/form';
import { cancelBookingMutation, completeBookingMutation, saveNoteMutation } from '../api/mutations';
import { bookingByIdOptions } from '../api/queries';
import type { AdminBookingDetail } from '../api/types';
import { ACTOR_LABELS, STATUS_LABELS, STATUS_TONES, minutesLeft, whenText } from '../lib/status';
import { ForwardButton } from './forward-button';

const at = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  dateStyle: 'medium',
  timeStyle: 'short'
});
const panel = 'bg-card rounded-2xl p-5 shadow-sm';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-1.5 text-sm'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 break-words'>{children}</dd>
    </div>
  );
}

function rulesText(b: AdminBookingDetail) {
  const r = b.rulesSnapshot;
  return [
    r.minMinutes && `Durasi minimal ${formatDuration(r.minMinutes)}`,
    r.cancelBeforeMinutes &&
      `Batal paling lambat ${formatDuration(r.cancelBeforeMinutes)} sebelumnya`,
    r.dpRequired && 'Wajib DP',
    ...(r.notes ?? [])
  ].filter(Boolean) as string[];
}

const detailEntries = (d: Record<string, unknown>) =>
  Object.entries(d).filter(
    ([k, v]) =>
      k !== 'preferredDate' && k !== 'period' && v !== null && v !== '' && typeof v !== 'object'
  );

/** Pesan WA hasil perubahan status. Mode cadangan: tombol untuk membuka pesan terisi. */
function Notices({ notices }: { notices: WaSendResult[] }) {
  if (!notices.length) return null;
  return (
    <div className={panel}>
      <h3 className='text-[1.0625rem] font-semibold'>Pesan WhatsApp</h3>
      <ul className='mt-3 space-y-2.5'>
        {notices.map((n) => (
          <li key={n.messageId} className='rounded-xl border p-3 text-sm'>
            <p className='line-clamp-2 whitespace-pre-line'>{n.text}</p>
            {n.mode === 'api' && n.status === 'sent' ? (
              <p className='mt-1.5 text-xs text-emerald-700 dark:text-emerald-300'>Terkirim</p>
            ) : (
              <a
                href={n.link}
                target='_blank'
                rel='noopener noreferrer'
                className='text-primary mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline'
              >
                <Icons.whatsapp className='size-3.5' />
                {n.status === 'failed' ? 'Gagal terkirim, buka WhatsApp' : 'Kirim lewat WhatsApp'}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Tulis alasan (minimal 5 karakter)')
    .max(300, 'Maksimal 300 karakter')
});
const noteSchema = z.object({ note: z.string().max(2000, 'Maksimal 2000 karakter') });

function CancelForm({ id, onDone }: { id: number; onDone: (n: WaSendResult[]) => void }) {
  const cancel = useMutation(cancelBookingMutation);
  const form = useAppForm({
    defaultValues: { reason: '' },
    validators: { onSubmit: cancelSchema },
    onSubmit: async ({ value }) => {
      try {
        const r = await cancel.mutateAsync({ id, reason: value.reason });
        toast.success('Pesanan dibatalkan');
        onDone(r.notices);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal membatalkan');
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
        name='reason'
        children={(f) => (
          <f.TextareaField
            label='Alasan pembatalan'
            rows={2}
            maxLength={300}
            description='Dikirim ke warga dan penyedia.'
          />
        )}
      />
      <form.AppForm>
        <form.SubmitButton variant='destructive' className='h-10 w-full'>
          Batalkan pesanan
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

function NoteForm({ id, note }: { id: number; note: string | null }) {
  const save = useMutation(saveNoteMutation);
  const form = useAppForm({
    defaultValues: { note: note ?? '' },
    validators: { onSubmit: noteSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync({ id, note: value.note });
        toast.success('Catatan disimpan');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan catatan');
      }
    }
  });
  return (
    <form
      className={`${panel} space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name='note'
        children={(f) => (
          <f.TextareaField
            label='Catatan admin'
            rows={3}
            maxLength={2000}
            description='Hanya terlihat tim, mis. "sudah ditelepon, penyedia libur".'
          />
        )}
      />
      <form.AppForm>
        <form.SubmitButton variant='outline' className='h-10 w-full'>
          Simpan catatan
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

export function BookingDetail({ id }: { id: number }) {
  const { data: b } = useSuspenseQuery(bookingByIdOptions(id));
  const complete = useMutation(completeBookingMutation);
  const [notices, setNotices] = useState<WaSendResult[]>([]);
  if (!b) notFound();

  const active = b.status === 'sent' || b.status === 'accepted' || b.status === 'in_progress';
  const rules = rulesText(b);
  const extra = detailEntries(b.details);

  return (
    <div className='w-full max-w-6xl space-y-4 pb-8'>
      <div className='flex flex-wrap items-center gap-3'>
        <Link
          href='/dashboard/bookings'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm'
        >
          <Icons.chevronLeft className='size-4' /> Semua pesanan
        </Link>
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <Pill tone={STATUS_TONES[b.status]}>{STATUS_LABELS[b.status]}</Pill>
        {b.stuck && <Pill tone='bad'>{b.stuck}</Pill>}
        {b.status === 'sent' && b.respondBy && (
          <span className='text-muted-foreground text-sm' suppressHydrationWarning>
            sisa {minutesLeft(b.respondBy)} menit untuk menjawab
          </span>
        )}
      </div>

      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]'>
        <div className='min-w-0 space-y-4'>
          <section className={panel}>
            <h3 className='text-[1.0625rem] font-semibold'>Pesanan</h3>
            <dl className='mt-2'>
              <Row label='Penyedia'>
                <Link
                  href={`/dashboard/listings/${b.listing.id}`}
                  className='font-medium underline-offset-4 hover:underline'
                >
                  {b.listing.name}
                </Link>
                {b.listing.whatsapp ? (
                  <span className='text-muted-foreground'> · WA {b.listing.whatsapp}</span>
                ) : (
                  <Pill tone='bad' className='ml-2'>
                    Tanpa WhatsApp
                  </Pill>
                )}
              </Row>
              <Row label='Kategori'>
                {b.category.name}
                {b.category.doorSlug && (
                  <span className='text-muted-foreground'> · /pintu/{b.category.doorSlug}</span>
                )}
              </Row>
              {b.unit && <Row label='Unit'>{b.unit.name}</Row>}
              <Row label='Jadwal'>{whenText(b)}</Row>
              <Row label='Jumlah'>{b.seats} orang</Row>
              <Row label='Kecamatan'>{b.district ?? '-'}</Row>
              <Row label='Harga tertera'>{b.price !== null ? formatRupiah(b.price) : '-'}</Row>
              {extra.map(([k, v]) => (
                <Row key={k} label={k === 'problem' ? 'Keluhan' : k}>
                  {v === true ? 'Ya' : v === false ? 'Tidak' : String(v)}
                </Row>
              ))}
              {rules.length > 0 && <Row label='Aturan disetujui'>{rules.join(' · ')}</Row>}
              <Row label='Dibuat'>{at.format(new Date(b.createdAt))}</Row>
              {b.respondBy && <Row label='Batas menjawab'>{at.format(new Date(b.respondBy))}</Row>}
            </dl>
          </section>

          <section className={panel}>
            <h3 className='text-[1.0625rem] font-semibold'>Riwayat status</h3>
            <ol className='mt-3 space-y-3 border-l pl-4'>
              {b.events.map((e, i) => (
                <li key={i} className='text-sm'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Pill tone={STATUS_TONES[e.toStatus]}>{STATUS_LABELS[e.toStatus]}</Pill>
                    <span className='text-muted-foreground text-xs'>
                      {ACTOR_LABELS[e.actor]} · {at.format(new Date(e.at))}
                    </span>
                  </div>
                  {e.reason && <p className='text-muted-foreground mt-1'>{e.reason}</p>}
                </li>
              ))}
            </ol>
          </section>

          {b.review && (
            <section className={panel}>
              <h3 className='text-[1.0625rem] font-semibold'>Ulasan warga</h3>
              <p className='mt-2 text-sm'>
                {b.review.satisfied ? 'Puas' : 'Kurang puas'}
                {b.review.stars ? ` · ${b.review.stars} bintang` : ''}
              </p>
              {b.review.comment && (
                <p className='text-muted-foreground mt-1 text-sm'>{b.review.comment}</p>
              )}
            </section>
          )}
        </div>

        <aside className='min-w-0 space-y-4'>
          <section className={panel}>
            <h3 className='text-[1.0625rem] font-semibold'>Kontak warga</h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              Hanya untuk menangani pesanan. Penyedia baru melihatnya setelah menerima.
            </p>
            {b.contact ? (
              <dl className='mt-2'>
                <Row label='Nama'>{b.contact.name}</Row>
                <Row label='WhatsApp'>
                  <a
                    href={`https://wa.me/${b.contact.phone}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='underline-offset-4 hover:underline'
                  >
                    {b.contact.phone}
                  </a>
                </Row>
                {b.contact.address && <Row label='Alamat'>{b.contact.address}</Row>}
                {b.contact.note && <Row label='Patokan'>{b.contact.note}</Row>}
              </dl>
            ) : (
              <p className='text-muted-foreground mt-2 text-sm'>Tidak ada data kontak.</p>
            )}
          </section>

          {active && (
            <section className={`${panel} space-y-3`}>
              <h3 className='text-[1.0625rem] font-semibold'>Tindakan</h3>
              {b.status === 'sent' && (
                <>
                  <ForwardButton id={b.id} className='w-full' />
                  <p className='text-muted-foreground text-xs'>
                    Membuka WhatsApp berisi pesanan dan tautan Terima/Tolak. Kirim dari nomor resmi
                    Kamanga ke {b.listing.whatsapp ?? 'penyedia'}.
                  </p>
                </>
              )}
              {(b.status === 'accepted' || b.status === 'in_progress') && (
                <Button
                  type='button'
                  className='h-10 w-full'
                  disabled={complete.isPending}
                  onClick={() =>
                    complete.mutate(b.id, {
                      onSuccess: (r) => {
                        toast.success('Pesanan ditandai selesai');
                        setNotices(r.notices);
                      },
                      onError: (e) => toast.error(e.message)
                    })
                  }
                >
                  <Icons.circleCheck className='mr-1.5 size-4' /> Tandai selesai
                </Button>
              )}
              <CancelForm id={b.id} onDone={setNotices} />
            </section>
          )}

          <Notices notices={notices} />
          <NoteForm id={b.id} note={b.adminNote} />
        </aside>
      </div>
    </div>
  );
}
