'use server';
// Aksi halaman Terima/Tolak lewat tautan token dari pesan WA, TANPA login (penyedia belum tentu punya akun).
// Token adalah kuncinya: setiap panggilan memvalidasi ulang token lewat booking.getBookingForProvider({ token })
// di actOnBooking sebelum mengubah apa pun. Pembatalan tidak bisa lewat token.
import { actOnBooking } from './bookings';
import type { ActionResult } from './types';

export async function actWithToken(
  token: string,
  action: string,
  reason?: string
): Promise<ActionResult> {
  if (typeof token !== 'string' || !/^[\w-]{20,100}$/.test(token))
    return { ok: false, message: 'Tautan tidak berlaku.' };
  return actOnBooking({ token }, { action, reason });
}
