'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as z from 'zod';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAppForm } from '@/lib/form';
import type { ClaimCodeResult } from '../api/claims';
import { requestClaimCode, verifyClaimCode } from '../api/service';

const SENT_TEXT: Record<'sent' | 'none' | 'rate_limited', string> = {
  sent: 'Kode dikirim ke WhatsApp usaha. Masukkan kodenya di bawah.',
  none: 'Klaim tercatat. Tim Kamanga akan menghubungi usaha ini untuk memastikan.',
  rate_limited: 'Terlalu sering meminta kode. Coba lagi beberapa menit lagi.'
};

/** Minta (atau kirim ulang) kode ke WA usaha. */
function useRequestCode() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (listingId: number) => {
      const r: ClaimCodeResult = await requestClaimCode(listingId);
      if (!r.ok) throw new Error(r.message);
      return r;
    },
    onSuccess: (r) => {
      (r.code === 'rate_limited' ? toast.warning : toast.success)(SENT_TEXT[r.code]);
      router.refresh();
    },
    onError: (e) => toast.error(e.message)
  });
}

export function ClaimButton({ listingId }: { listingId: number }) {
  const req = useRequestCode();
  return (
    <Button
      className='h-11 shrink-0'
      disabled={req.isPending}
      onClick={() => req.mutate(listingId)}
    >
      <Icons.key aria-hidden /> Klaim usaha
    </Button>
  );
}

/** Kode 6 angka dari WA usaha. Benar = usaha langsung menjadi milik mitra. */
export function ClaimVerify({ claimId, listingId }: { claimId: number; listingId: number }) {
  const router = useRouter();
  const resend = useRequestCode();
  const verify = useMutation({
    mutationFn: async (code: string) => {
      const r = await verifyClaimCode(claimId, code);
      if (!r.ok) throw new Error(r.message);
      return r;
    },
    onSuccess: () => {
      toast.success('Klaim berhasil. Usaha ini sekarang Anda kelola.');
      router.push('/mitra');
      router.refresh();
    },
    onError: (e) => toast.error(e.message)
  });
  const form = useAppForm({
    defaultValues: { code: '' },
    validators: { onSubmit: z.object({ code: z.string().regex(/^\d{6}$/, 'Isi 6 angka') }) },
    onSubmit: ({ value }) => verify.mutate(value.code)
  });
  return (
    <form
      className='mt-3 space-y-3'
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name='code'
        children={(f) => <f.OtpField label='Kode dari WhatsApp usaha' required />}
      />
      <div className='grid grid-cols-2 gap-2'>
        <form.AppForm>
          <form.SubmitButton className='h-11' disabled={verify.isPending}>
            Verifikasi
          </form.SubmitButton>
        </form.AppForm>
        <Button
          type='button'
          variant='outline'
          className='h-11'
          disabled={resend.isPending}
          onClick={() => resend.mutate(listingId)}
        >
          Kirim ulang kode
        </Button>
      </div>
    </form>
  );
}
