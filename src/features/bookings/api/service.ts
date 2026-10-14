'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
// Perubahan status lewat Mesin Pesanan dengan pelaku admin (tercatat di riwayat).
import { booking, type Actor, type TransitionResult } from '@/lib/engines/contracts';
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type {
  ActionResult,
  AdminBookingDetail,
  BookingFilters,
  BookingRow,
  BookingsResponse,
  ForwardResult,
  NoteResult
} from './types';

const FAIL: Record<string, string> = {
  not_found: 'Pesanan tidak ditemukan',
  invalid_transition: 'Status pesanan sudah berubah. Muat ulang halaman.',
  too_late: 'Sudah terlambat untuk perubahan ini'
};
const toAction = (r: TransitionResult): ActionResult =>
  r.ok ? { ok: true, notices: r.notices } : { ok: false, message: FAIL[r.reason] };

async function adminActor(): Promise<Actor> {
  const { user } = await requireAdmin();
  return { kind: 'admin', userId: user.id };
}

export async function getBookings(filters: BookingFilters): Promise<BookingsResponse> {
  await requireAdmin();
  return repo.listAdminBookings(filters);
}

export async function getForwardQueue(): Promise<BookingRow[]> {
  await requireAdmin();
  return repo.listForwardQueue();
}

export async function getBookingById(id: number): Promise<AdminBookingDetail | null> {
  await requireAdmin();
  return repo.getAdminBooking(Number(id));
}

/** Mode cadangan: tautan wa.me untuk dikirim tim dari nomor resmi Kamanga (rencana keputusan 8). */
export async function forwardToProvider(id: number): Promise<ForwardResult> {
  await requireAdmin();
  const r = await booking.resendProviderNotice(Number(id));
  if (r.ok) return { ok: true, notice: r.notice };
  return {
    ok: false,
    message:
      r.reason === 'not_found'
        ? FAIL.not_found
        : 'Pesanan sudah dijawab, atau penyedia belum punya nomor WhatsApp.'
  };
}

export async function cancelBookingAsAdmin(id: number, reason: string): Promise<ActionResult> {
  const actor = await adminActor();
  const why = String(reason ?? '').trim();
  if (why.length < 5) return { ok: false, message: 'Tulis alasan pembatalan (minimal 5 karakter)' };
  return toAction(await booking.cancelBooking(Number(id), actor, why.slice(0, 300)));
}

export async function completeBookingAsAdmin(id: number): Promise<ActionResult> {
  const actor = await adminActor();
  return toAction(await booking.completeBooking(Number(id), actor));
}

export async function saveBookingNote(id: number, note: string): Promise<NoteResult> {
  await requireAdmin();
  const text = String(note ?? '');
  if (text.length > 2000) return { ok: false, message: 'Catatan maksimal 2000 karakter' };
  return (await repo.saveAdminNote(Number(id), text))
    ? { ok: true }
    : { ok: false, message: FAIL.not_found };
}
