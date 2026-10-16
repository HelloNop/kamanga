'use client';
import { toast } from 'sonner';
import type { WaSendResult } from '@/lib/engines/contracts';

/**
 * Jalankan aksi yang membuat pesan WA lalu tangani hasilnya.
 * Mode cadangan: buka tautan wa.me di tab baru agar tim mengirimnya dari nomor resmi Kamanga.
 * Tab dibuka saat tombol diklik (sebelum menunggu server) supaya tidak diblokir peramban.
 */
export async function sendViaWa(run: () => Promise<WaSendResult>): Promise<WaSendResult | null> {
  const tab = window.open('', '_blank');
  try {
    const r = await run();
    if (r.mode === 'api' && r.status === 'sent') {
      tab?.close();
      toast.success('Terkirim lewat WhatsApp');
      return r;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = r.link;
    }
    const open = {
      label: 'Buka WhatsApp',
      onClick: () => window.open(r.link, '_blank', 'noopener')
    };
    if (r.status === 'failed')
      toast.error('Gagal terkirim. Kirim manual lewat WhatsApp.', { action: open });
    else if (tab) toast.success('WhatsApp dibuka. Kirim pesannya dari nomor resmi Kamanga.');
    else toast.info('Tab baru diblokir peramban.', { action: open });
    return r;
  } catch (e) {
    tab?.close();
    toast.error(e instanceof Error ? e.message : 'Gagal membuat pesan WhatsApp');
    return null;
  }
}
