'use server';
// Pintu masuk dashboard mitra (Server Action = endpoint publik). SETIAP fungsi lebih dulu memanggil:
// - vendorOwning(): requireVendor() + listing harus milik mitra itu, atau
// - editor(): admin ATAU mitra pemilik listing (ScheduleEditor dan QaEditor dipakai juga di panel admin,
//   karena tim mengisi jadwal penyedia yang belum punya akun).
// Kontak warga hanya lewat booking.getBookingForProvider (mesin yang menyaring).
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  type Actor,
  booking,
  type BookingStatus,
  type BookingView,
  type ProviderBookingView,
  schedule
} from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { requireSession, requireVendor } from '@/lib/session';
import { timed } from '../lib/format';
import { actOnBooking } from './bookings';
import { ACTIVE_LISTING_COOKIE } from './context';
import * as repo from './repository';
import type {
  ActionResult,
  AnswerResult,
  CalendarSlot,
  HomeData,
  QaData,
  ReviewsData,
  ScheduleEditorData,
  StatsData
} from './types';

const validId = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

async function vendorOwning(listingId: number) {
  const { user } = await requireVendor();
  if (!validId(listingId) || !(await repo.isOwner(user.id, listingId)))
    throw new Error('Usaha tidak ditemukan');
  return user;
}

async function editor(listingId: number) {
  const { user } = await requireSession();
  if (!validId(listingId) || !(await repo.canEdit(user, listingId)))
    throw new Error('Anda tidak berhak mengubah usaha ini');
  const isAdmin = user.role === 'admin';
  return {
    viewer: (isAdmin ? 'admin' : 'vendor') as 'admin' | 'vendor',
    actor: { kind: isAdmin ? 'admin' : 'provider', userId: user.id } satisfies Actor
  };
}

// ───────────────────────────── Usaha aktif ─────────────────────────────

export async function setActiveListing(listingId: number) {
  await vendorOwning(listingId);
  (await cookies()).set(ACTIVE_LISTING_COOKIE, String(listingId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/mitra',
    maxAge: 60 * 60 * 24 * 365
  });
  revalidatePath('/mitra', 'layout');
}

// ───────────────────────────── Beranda ─────────────────────────────

export async function getHome(listingId: number): Promise<HomeData> {
  const user = await vendorOwning(listingId);
  const today = jakartaDate(new Date());
  const ids = [listingId];
  const [own, todays, waiting, month, missing, questions, units] = await Promise.all([
    repo.ownedListings(user.id).then((l) => l.find((x) => x.id === listingId)),
    booking.listBookings({
      listingIds: ids,
      from: fromJakarta(today, '00:00'),
      to: fromJakarta(addDays(today, 1), '00:00'),
      status: ['sent', 'accepted', 'in_progress', 'completed']
    }),
    booking.listBookings({ listingIds: ids, status: ['sent'] }),
    repo.monthSummary(listingId, fromJakarta(`${today.slice(0, 8)}01`, '00:00')),
    repo.missingAttributes(listingId),
    repo.pendingQuestionCount(listingId),
    repo.unitCount(listingId)
  ]);
  const usaha = `/mitra/usaha/${listingId}`;
  const conflicts = timed(own?.scheduleKind) ? await schedule.findConflicts(listingId) : [];
  const tasks: HomeData['tasks'] = [];
  if (own?.status === 'draft')
    tasks.push({
      key: 'draft',
      text: 'Lengkapi data usaha lalu kirim untuk ditinjau',
      href: usaha
    });
  if (own?.status === 'rejected')
    tasks.push({ key: 'rejected', text: 'Usaha perlu diperbaiki. Lihat catatan tim', href: usaha });
  if (timed(own?.scheduleKind) && units === 0)
    tasks.push({ key: 'units', text: 'Atur unit dan jam buka', href: '/mitra/jadwal' });
  if (conflicts.length)
    tasks.push({
      key: 'conflicts',
      text: `${conflicts.length} pesanan bentrok dengan jadwal terbaru`,
      href: '/mitra/jadwal'
    });
  if (questions)
    tasks.push({
      key: 'questions',
      text: `Jawab ${questions} pertanyaan warga`,
      href: '/mitra/tanya-jawab'
    });
  if (missing.length)
    tasks.push({
      key: 'rules',
      text: `Lengkapi isian aturan: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', …' : ''}`,
      href: usaha
    });
  return { today: todays.items, waiting: waiting.items, month, tasks };
}

// ───────────────────────────── Pesanan ─────────────────────────────

export type BookingTab = 'masuk' | 'aktif' | 'selesai' | 'batal';
const TAB_STATUS: Record<BookingTab, BookingStatus[]> = {
  masuk: ['sent'],
  aktif: ['accepted', 'in_progress'],
  selesai: ['completed'],
  batal: ['rejected', 'expired', 'cancelled']
};

export async function getBookings(
  listingId: number,
  tab: BookingTab
): Promise<{ items: BookingView[]; total: number }> {
  await vendorOwning(listingId);
  return booking.listBookings({
    listingIds: [listingId],
    status: TAB_STATUS[tab] ?? TAB_STATUS.masuk,
    limit: 100
  });
}

/** Satu pesanan milik mitra. Kontak warga hanya terisi setelah diterima (disaring mesin). */
export async function getBooking(bookingId: number): Promise<ProviderBookingView | null> {
  const { user } = await requireVendor();
  if (!validId(bookingId)) return null;
  return booking.getBookingForProvider({ bookingId, userId: user.id });
}

export async function actOnMyBooking(
  bookingId: number,
  action: string,
  reason?: string
): Promise<ActionResult> {
  const { user } = await requireVendor();
  if (!validId(bookingId)) return { ok: false, message: 'Pesanan tidak ditemukan.' };
  return actOnBooking({ bookingId, userId: user.id }, { action, reason });
}

// ───────────────────────────── Aturan, ulasan, statistik ─────────────────────────────

/** Label isian aturan kategori yang belum diisi. */
export async function getMissingRules(listingId: number): Promise<string[]> {
  await vendorOwning(listingId);
  return repo.missingAttributes(listingId);
}

export async function getReviews(listingId: number): Promise<ReviewsData> {
  await vendorOwning(listingId);
  return repo.reviewsFor(listingId);
}

export async function getStats(listingId: number): Promise<StatsData> {
  await vendorOwning(listingId);
  return repo.stats(listingId);
}

// ───────────────────────────── Jadwal (admin atau mitra pemilik) ─────────────────────────────

export async function getScheduleEditor(listingId: number): Promise<ScheduleEditorData | null> {
  const { viewer } = await editor(listingId);
  return repo.scheduleEditorData(listingId, viewer);
}

export async function getCalendar(
  listingId: number,
  unitId: number,
  date: string
): Promise<CalendarSlot[] | null> {
  const { viewer } = await editor(listingId);
  return validId(unitId) ? repo.calendar(listingId, unitId, date, viewer) : null;
}

export async function saveUnit(listingId: number, unitId: number | null, input: unknown) {
  await editor(listingId);
  return repo.saveUnit(listingId, unitId === null || validId(unitId) ? unitId : -1, input);
}

export async function setUnitActive(listingId: number, unitId: number, active: boolean) {
  await editor(listingId);
  return repo.setUnitActive(listingId, unitId, active === true);
}

export async function saveRules(listingId: number, unitId: number, patterns: unknown) {
  await editor(listingId);
  return repo.replaceRules(listingId, unitId, patterns);
}

export async function saveException(listingId: number, input: unknown) {
  await editor(listingId);
  return repo.saveException(listingId, input);
}

export async function deleteException(listingId: number, id: number) {
  await editor(listingId);
  return repo.deleteException(listingId, id);
}

export async function blockSlot(listingId: number, input: unknown) {
  const { actor } = await editor(listingId);
  return repo.blockSlot(listingId, input, actor);
}

export async function unblockSlot(listingId: number, blockId: number) {
  const { actor } = await editor(listingId);
  return repo.unblockSlot(listingId, blockId, actor);
}

// ───────────────────────────── Tanya jawab (admin atau mitra pemilik) ─────────────────────────────

export async function getQa(listingId: number): Promise<QaData | null> {
  const { viewer } = await editor(listingId);
  return repo.qaData(listingId, viewer);
}

export async function saveQa(listingId: number, id: number | null, input: unknown) {
  await editor(listingId);
  return repo.saveQa(listingId, id === null || validId(id) ? id : -1, input);
}

export async function deleteQa(listingId: number, id: number) {
  await editor(listingId);
  return repo.deleteQa(listingId, id);
}

export async function moveQa(listingId: number, id: number, dir: -1 | 1) {
  await editor(listingId);
  return repo.moveQa(listingId, id, dir === -1 ? -1 : 1);
}

export async function answerQuestion(
  listingId: number,
  id: number,
  input: unknown
): Promise<AnswerResult> {
  const { viewer } = await editor(listingId);
  return repo.answerQuestion(listingId, id, input, viewer);
}
