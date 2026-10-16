'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { BookingStatus } from '@/lib/engines/contracts';
import { useAppForm } from '@/lib/form';
import { cn } from '@/lib/utils';
import { actOnMyBooking } from '../api/service';
import { actWithToken } from '../api/token-actions';
import type { CitizenNotice } from '../lib/notices';
import type { BookingAction } from '../schemas';

/** id: mitra berakun (dashboard). token: halaman tautan dari pesan WA (tanpa login, tanpa batal). */
type Target = { id: number } | { token: string };

const DONE: Record<BookingAction, string> = {
  accept: 'Pesanan diterima. Kontak pemesan sekarang terlihat.',
  reject: 'Pesanan ditolak.',
  start: 'Layanan dimulai.',
  complete: 'Pesanan selesai. Pemesan akan ditanya ulasannya.',
  cancel: 'Pesanan dibatalkan.'
};
const REJECT_REASONS = ['Sudah penuh', 'Sedang tutup', 'Di luar area layanan'];

/** Tombol "Kabari pemesan" dari hasil transisi (hanya pesan untuk warga, setelah kontak terbuka). */
export function NoticeButtons({ notices }: { notices: CitizenNotice[] }) {
  if (!notices.length) return null;
  return (
    <div className='mt-3 space-y-2' role='status'>
      {notices.map((n) =>
        n.status === 'sent' ? (
          <p key={n.link} className='text-sm text-emerald-800 dark:text-emerald-300'>
            Pemesan sudah dikabari lewat WhatsApp.
          </p>
        ) : (
          <a
            key={n.link}
            href={n.link}
            target='_blank'
            rel='noopener noreferrer'
            className={cn(
              buttonVariants(),
              'w-full bg-none bg-emerald-700 text-white shadow-none hover:bg-emerald-800'
            )}
          >
            <Icons.whatsapp aria-hidden /> Kabari pemesan lewat WhatsApp
          </a>
        )
      )}
    </div>
  );
}

function ReasonDialog({
  kind,
  loading,
  onClose,
  onSubmit
}: {
  kind: 'reject' | 'cancel';
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const required = kind === 'cancel';
  const form = useAppForm({
    defaultValues: { reason: '' },
    validators: {
      onSubmit: z.object({
        reason: required
          ? z.string().trim().min(3, 'Tulis alasan pembatalan').max(300, 'Maksimal 300 karakter')
          : z.string().trim().max(300, 'Maksimal 300 karakter')
      })
    },
    onSubmit: ({ value }) => onSubmit(value.reason.trim())
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'cancel' ? 'Batalkan pesanan?' : 'Tolak pesanan?'}</DialogTitle>
          <DialogDescription>
            {kind === 'cancel'
              ? 'Alasan dikirim ke pemesan. Jadwalnya kembali kosong.'
              : 'Pemesan diberi tahu dan ditawari penyedia lain.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className='space-y-3'
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          {kind === 'reject' && (
            <div className='flex flex-wrap gap-2' role='group' aria-label='Alasan cepat'>
              {REJECT_REASONS.map((r) => (
                <Button
                  key={r}
                  type='button'
                  variant='secondary'
                  size='sm'
                  className='h-11'
                  onClick={() => form.setFieldValue('reason', r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          )}
          <form.AppField
            name='reason'
            children={(f) => (
              <f.TextareaField
                label={required ? 'Alasan' : 'Alasan (boleh kosong)'}
                required={required}
                rows={2}
                maxLength={300}
              />
            )}
          />
          <div className='grid grid-cols-2 gap-2'>
            <Button type='button' variant='outline' onClick={onClose}>
              Kembali
            </Button>
            <form.AppForm>
              <form.SubmitButton variant='destructive' disabled={loading}>
                {kind === 'cancel' ? 'Batalkan' : 'Tolak'}
              </form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BookingActions({
  target,
  status,
  canComplete = true
}: {
  target: Target;
  status: BookingStatus;
  /** false sebelum jadwal mulai (mesin menolak "selesai" lebih awal). */
  canComplete?: boolean;
}) {
  const router = useRouter();
  const [notices, setNotices] = useState<CitizenNotice[]>([]);
  const [ask, setAsk] = useState<'reject' | 'cancel' | null>(null);
  const act = useMutation({
    mutationFn: async (v: { action: BookingAction; reason?: string }) => {
      const r =
        'token' in target
          ? await actWithToken(target.token, v.action, v.reason)
          : await actOnMyBooking(target.id, v.action, v.reason);
      if (!r.ok) throw new Error(r.message);
      return { ...r, action: v.action };
    },
    onSuccess: (r) => {
      toast.success(DONE[r.action]);
      setNotices(r.notices);
      setAsk(null);
      router.refresh();
    },
    onError: (e) => {
      toast.error(e.message);
      router.refresh();
    }
  });
  const busy = act.isPending;
  const canCancel = 'id' in target;
  const run = (action: BookingAction) => act.mutate({ action });

  return (
    <>
      <div className='mt-4 grid grid-cols-2 gap-2'>
        {status === 'sent' && (
          <>
            <Button disabled={busy} onClick={() => run('accept')}>
              <Icons.check aria-hidden /> Terima
            </Button>
            <Button variant='outline' disabled={busy} onClick={() => setAsk('reject')}>
              <Icons.close aria-hidden /> Tolak
            </Button>
          </>
        )}
        {status === 'accepted' && (
          <Button variant='secondary' disabled={busy} onClick={() => run('start')}>
            Mulai layanan
          </Button>
        )}
        {canComplete && (status === 'accepted' || status === 'in_progress') && (
          <Button
            disabled={busy}
            onClick={() => run('complete')}
            className={status === 'in_progress' ? 'col-span-2' : undefined}
          >
            <Icons.circleCheck aria-hidden /> Tandai selesai
          </Button>
        )}
        {canCancel && (status === 'accepted' || status === 'in_progress') && (
          <Button
            variant='ghost'
            disabled={busy}
            onClick={() => setAsk('cancel')}
            className='text-destructive col-span-2'
          >
            Batalkan pesanan
          </Button>
        )}
      </div>
      <NoticeButtons notices={notices} />
      {ask && (
        <ReasonDialog
          key={ask}
          kind={ask}
          loading={busy}
          onClose={() => setAsk(null)}
          onSubmit={(reason) => act.mutate({ action: ask, reason })}
        />
      )}
    </>
  );
}
