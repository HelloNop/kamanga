// Pesanan untuk panel admin. TANPA pemeriksaan login: hanya diimpor oleh service.ts (dan uji).
// Pesanan dibaca dan diubah lewat Mesin Pesanan; repository ini hanya menambah catatan admin dan penyaring.
import { eq, ilike } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, listings } from '@/db/schema';
import { booking, type BookingStatus, type BookingView } from '@/lib/engines/contracts';
import { ACTIVE_STATUSES, BOOKING_STATUSES, stuckReason } from '../lib/status';
import type { AdminBookingDetail, BookingFilters, BookingRow, BookingsResponse } from './types';

const DAY_MS = 86_400_000;
const csv = (s?: string) =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const withStuck =
  (now: Date) =>
  (b: BookingView): BookingRow => ({ ...b, stuck: stuckReason(b, now) });

const ok = (n?: number): n is number => n !== undefined && Number.isFinite(n) && n > 0;

/** "msDari,msSampai" → rentang; tanggal akhir ikut dihitung sampai akhir harinya. */
function parseWhen(when?: string): { from?: Date; to?: Date } {
  const [a, b] = csv(when).map(Number);
  return {
    from: ok(a) ? new Date(a) : undefined,
    to: ok(b) ? new Date(b + DAY_MS) : ok(a) ? new Date(a + DAY_MS) : undefined
  };
}

async function listingIdsByName(q: string) {
  const rows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(ilike(listings.name, `%${escapeLike(q.trim())}%`))
    .limit(200);
  return rows.map((r) => r.id);
}

export async function listAdminBookings(
  f: BookingFilters,
  now = new Date()
): Promise<BookingsResponse> {
  const limit = Math.min(Math.max(f.limit ?? 20, 1), 100);
  const page = Math.max(f.page ?? 1, 1);
  const status = csv(f.status).filter((s): s is BookingStatus =>
    (BOOKING_STATUSES as string[]).includes(s)
  );
  const listingIds = f.listing?.trim() ? await listingIdsByName(f.listing) : undefined;
  const { from, to } = parseWhen(f.when);

  if (csv(f.flag).includes('stuck')) {
    // Macet hanya mungkin untuk pesanan aktif; dinilai dengan stuckReason yang sama dengan tampilan.
    // ponytail: dibatasi 500 pesanan aktif terbaru; pindahkan penilaian ke SQL bila pesanan aktif sebanyak itu.
    const active = (status.length ? status : ACTIVE_STATUSES).filter((s) =>
      ACTIVE_STATUSES.includes(s)
    );
    const r = await booking.listBookings({ status: active, listingIds, from, to, limit: 500 });
    const stuck = r.items.map(withStuck(now)).filter((b) => b.stuck);
    return { items: stuck.slice((page - 1) * limit, page * limit), total: stuck.length };
  }

  const r = await booking.listBookings({
    status: status.length ? status : undefined,
    listingIds,
    from,
    to,
    limit,
    offset: (page - 1) * limit
  });
  return { items: r.items.map(withStuck(now)), total: r.total };
}

/** Antrean "Perlu diteruskan": semua pesanan yang menunggu jawaban, sisa waktu tersingkat dulu. */
export async function listForwardQueue(now = new Date()): Promise<BookingRow[]> {
  const r = await booking.listBookings({ status: ['sent'], limit: 100 });
  return r.items
    .map(withStuck(now))
    .toSorted(
      (a, b) =>
        (a.respondBy?.getTime() ?? Infinity) - (b.respondBy?.getTime() ?? Infinity) || a.id - b.id
    );
}

export async function getAdminBooking(id: number): Promise<AdminBookingDetail | null> {
  const view = await booking.getBookingForAdmin(id);
  if (!view) return null;
  const [row] = await db
    .select({ adminNote: bookings.adminNote })
    .from(bookings)
    .where(eq(bookings.id, id));
  return { ...view, adminNote: row?.adminNote ?? null, stuck: stuckReason(view) };
}

export async function saveAdminNote(id: number, note: string) {
  const rows = await db
    .update(bookings)
    .set({ adminNote: note.trim() || null })
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id });
  return rows.length > 0;
}
