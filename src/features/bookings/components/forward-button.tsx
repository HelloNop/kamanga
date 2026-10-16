'use client';
import { useMutation } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { forwardMutation } from '../api/mutations';
import { sendViaWa } from '../lib/wa-window';

/** "Teruskan ke penyedia (WA)": membangun ulang pesan pesanan baru dengan tautan Terima/Tolak yang sama. */
export function ForwardButton({ id, className }: { id: number; className?: string }) {
  const m = useMutation(forwardMutation);
  return (
    <Button
      type='button'
      size='sm'
      disabled={m.isPending}
      onClick={() => sendViaWa(() => m.mutateAsync(id))}
      className={cn('h-10 bg-emerald-600 text-white hover:bg-emerald-700', className)}
    >
      <Icons.whatsapp className='mr-1.5 size-4' /> Teruskan ke penyedia
    </Button>
  );
}
