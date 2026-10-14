// Pesanan untuk panel admin. TANPA pemeriksaan login: hanya diimpor oleh service.ts (dan uji).
// Pesanan dibaca dan diubah lewat Mesin Pesanan; repository ini hanya menambah catatan admin dan penyaring.
import { eq, ilike, sql } from 'drizzle-orm';
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

// ───── Pesan ke warga yang menunggu dikirim tim (mode cadangan WA) ─────

/** Template yang ditujukan ke warga. booking_cancelled bisa ke dua arah: disaring dengan nomor penyedia. */
export const CITIZEN_TEMPLATES = [
  'booking_accepted',
  'booking_rejected',
  'booking_expired',
  'booking_cancelled',
  'booking_reminder',
  'review_request',
  'question_answered'
] as const;

export type PendingMessageRow = {
  id: number;
  template: (typeof CITIZEN_TEMPLATES)[number];
  phone: string;
  params: Record<string, unknown>;
  bookingId: number | null;
  code: string | null;
  createdAt: Date;
};

/** Pesan mode cadangan ke warga yang belum dikirim (3 hari terakhir), terlama dulu. */
export async function listPendingCitizenMessages(): Promise<PendingMessageRow[]> {
  const rows = (
    await db.execute(sql`
      select m.id, m.template, m.phone, m.params, m.booking_id, b.code, m.created_at
      from wa_messages m
      left join bookings b on b.id = m.booking_id
      left join listings l on l.id = b.listing_id
      where m.direction = 'outbound' and m.mode = 'fallback' and m.status = 'link'
        and m.template = any(${sql.raw(`array['${CITIZEN_TEMPLATES.join("','")}']`)})
        and m.phone <> 'dihapus' and (l.whatsapp is null or m.phone <> l.whatsapp)
        and m.created_at > now() - interval '3 days'
      order by m.created_at
      limit 50`)
  ).rows as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    template: r.template as PendingMessageRow['template'],
    phone: String(r.phone),
    params: (r.params as Record<string, unknown>) ?? {},
    bookingId: r.booking_id === null ? null : Number(r.booking_id),
    code: (r.code as string | null) ?? null,
    createdAt: new Date(r.created_at as string)
  }));
}

/** Tandai terkirim (tim sudah mengirim dari nomor resmi Kamanga). */
export async function markCitizenMessageSent(id: number) {
  await db.execute(
    sql`update wa_messages set status = 'sent', updated_at = now() where id = ${id} and status = 'link'`
  );
}
