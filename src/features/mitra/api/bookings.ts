// Inti aksi pesanan penyedia. TANPA pemeriksaan login: dipanggil service.ts (setelah requireVendor) dan
// token-actions.ts (token dari pesan WA sebagai kunci). Akses selalu dicek lewat booking.getBookingForProvider,
// jadi penyedia hanya bisa mengubah pesanan miliknya / pesanan yang tokennya ia pegang.
import {
  type Actor,
  booking,
  type ProviderAccess,
  type TransitionResult
} from '@/lib/engines/contracts';
import { citizenNotices } from '../lib/notices';
import { type BookingAction, bookingActionSchema } from '../schemas';
import type { ActionResult } from './types';

const FAIL_TEXT = {
  not_found: 'Pesanan tidak ditemukan.',
  invalid_transition: 'Status pesanan sudah berubah. Muat ulang halaman ini.',
  too_late: 'Batas waktu menjawab sudah lewat, pesanan kedaluwarsa.'
} as const;

function run(id: number, action: BookingAction, actor: Actor, reason: string) {
  switch (action) {
    case 'accept':
      return booking.respondBooking(id, 'accept', actor);
    case 'reject':
      return booking.respondBooking(id, 'reject', actor, reason || undefined);
    case 'start':
      return booking.startBooking(id, actor);
    case 'complete':
      return booking.completeBooking(id, actor);
    case 'cancel':
      return booking.cancelBooking(id, actor, reason);
  }
}

/** Jalankan satu aksi pada pesanan yang boleh diakses `access`. Token: hanya terima/tolak/mulai/selesai. */
export async function actOnBooking(
  access: ProviderAccess,
  input: { action: string; reason?: string }
): Promise<ActionResult> {
  const parsed = bookingActionSchema.safeParse({
    action: input.action,
    reason: input.reason ?? ''
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { action, reason } = parsed.data;
  if ('token' in access && action === 'cancel')
    return { ok: false, message: 'Pembatalan dilakukan dari dashboard mitra.' };

  // Validasi ulang akses setiap kali (token / kepemilikan), lalu pakai id dari hasilnya.
  const before = await booking.getBookingForProvider(access);
  if (!before) return { ok: false, message: FAIL_TEXT.not_found };
  const actor: Actor = { kind: 'provider', userId: 'userId' in access ? access.userId : null };
  const r: TransitionResult = await run(before.id, action, actor, reason);
  if (!r.ok) return { ok: false, message: FAIL_TEXT[r.reason] };

  // Kontak sebelum transisi (batal setelah diterima) atau sesudahnya (baru diterima).
  const after = await booking.getBookingForProvider(access);
  const phone = before.contact?.phone ?? after?.contact?.phone;
  return {
    ok: true,
    status: r.status,
    notices: citizenNotices(r.notices, phone, before.listing.whatsapp)
  };
}
