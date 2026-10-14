import { normalizeWhatsapp } from '@/features/listings/lib/format';
import type { WaSendResult } from '@/lib/engines/contracts';

/** Pesan WA untuk warga yang boleh ditampilkan ke penyedia sebagai tombol (mode cadangan). */
export type CitizenNotice = Pick<WaSendResult, 'mode' | 'status' | 'link'>;

/**
 * Dari hasil transisi pesanan, ambil HANYA pesan yang ditujukan ke nomor warga, dan hanya bila kontak warga
 * memang sudah terbuka untuk penyedia (contactPhone terisi). Pesan untuk penyedia sendiri (mis. booking_contact
 * yang memuat tautan token) dan pesan ke warga saat kontak masih tertutup (mis. penolakan) dibuang, karena
 * tautan wa.me memuat nomor tujuan.
 */
export function citizenNotices(
  notices: WaSendResult[],
  contactPhone: string | null | undefined,
  providerPhone: string | null | undefined
): CitizenNotice[] {
  const to = contactPhone ? normalizeWhatsapp(contactPhone) : null;
  if (!to || to === (providerPhone ? normalizeWhatsapp(providerPhone) : null)) return [];
  return notices
    .filter((n) => n.link.startsWith(`https://wa.me/${to}?`))
    .map(({ mode, status, link }) => ({ mode, status, link }));
}
