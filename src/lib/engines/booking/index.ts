// Mesin Pesanan (PRD 8.5). Kontrak: ../contracts.ts. Keputusan lead: docs/rencana-tahap1.md §2 (1, 5, 6, 7, 14, 16).
// Binding dari ../contracts (schedule, notify, appUrl, paths) hanya dipakai di dalam fungsi karena impor melingkar.
//
// Aturan privasi (UU PDP): kontak warga ada di booking_contacts dan hanya dibaca di sini. Penyedia baru
// melihatnya bila status accepted / in_progress / completed; sebelumnya hanya nama kecamatan.
import { createHash, createHmac, randomInt } from 'node:crypto';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookingContacts,
  bookingEvents,
  bookings,
  categories,
  doors,
  listingCategories,
  listings,
  locations,
  reviews,
  units
} from '@/db/schema';
import { getSetting } from '@/lib/settings';
import {
  type Actor,
  appUrl,
  type BookingEngine,
  type BookingListFilter,
  type BookingStatus,
  type BookingView,
  type CreateBookingFail,
  type CreateBookingInput,
  notify,
  paths,
  type ProviderAccess,
  type ProviderBookingView,
  type RulesSnapshot,
  schedule,
  type TransitionResult,
  type WaParams,
  type WaRecipient,
  type WaSendResult,
  type WaTemplate
} from '../contracts';
import { formatDay, formatSlot, fromJakarta, jakartaDate } from '../time';

type BookingRow = typeof bookings.$inferSelect;
type Fail = 'not_found' | 'invalid_transition' | 'too_late';

const SYSTEM: Actor = { kind: 'system' };
const EXPIRED_REASON = 'Tidak dijawab dalam batas waktu';
/** Status yang membuka kontak warga ke penyedia. */
const CONTACT_OPEN: BookingStatus[] = ['accepted', 'in_progress', 'completed'];
const BOOKABLE_KINDS = ['slot', 'seat', 'none'];
const PERIODS = ['pagi', 'siang', 'sore', 'malam'];
/** Selesai otomatis bila jadwal sudah lewat selama ini. */
const AUTO_COMPLETE_MS = 2 * 60 * 60 * 1000;

// Kode pesanan: 6 karakter tanpa huruf/angka yang mirip (I, O, 0, 1).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () =>
  Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/**
 * Token tautan Terima/Tolak penyedia (256 bit). Database hanya menyimpan sha256-nya. Token diturunkan dari
 * kode pesanan + rahasia server (bukan acak murni) agar pengingat ke penyedia bisa memuat tautan yang sama;
 * tanpa rahasia server, token tidak bisa ditebak walau isi database bocor.
 */
function providerToken(code: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error('Mesin Pesanan: BETTER_AUTH_SECRET belum diatur');
  return createHmac('sha256', secret).update(`kamanga:booking-token:${code}`).digest('base64url');
}
const providerLink = (code: string) => appUrl(paths.providerBookingToken(providerToken(code)));

/** Kode galat Postgres (Drizzle membungkus galat pg di `cause`). */
const pgCode = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } } | null;
  return err?.code ?? err?.cause?.code;
};

const citizenLink = (id: number) => appUrl(paths.citizenBooking(id));

// ───────────────────────────── Notifikasi ─────────────────────────────

/** Kirim lewat mesin Notifikasi. Gagal kirim dicatat ke log dan tidak membatalkan perubahan yang sudah tersimpan. */
async function send<T extends WaTemplate>(
  template: T,
  to: WaRecipient,
  params: WaParams[T],
  bookingId: number
): Promise<WaSendResult | null> {
  try {
    return await notify.sendWa(template, to, params, { bookingId });
  } catch (e) {
    console.error(`[pesanan] gagal mengirim ${template} untuk pesanan ${bookingId}`, e);
    return null;
  }
}

/** Data pesanan untuk menyusun pesan WA (termasuk kontak warga: hanya untuk pesan, tidak dikembalikan ke luar). */
async function loadInfo(id: number) {
  const [r] = await db
    .select({
      code: bookings.code,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      details: bookings.details,
      listing: listings.name,
      providerPhone: listings.whatsapp,
      category: categories.name,
      unit: units.name,
      name: bookingContacts.name,
      phone: bookingContacts.phone,
      address: bookingContacts.address,
      note: bookingContacts.note
    })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .leftJoin(units, eq(units.id, bookings.unitId))
    .leftJoin(bookingContacts, eq(bookingContacts.bookingId, bookings.id))
    .where(eq(bookings.id, id));
  return r ?? null;
}

/** "Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00" atau "Servis AC · Kamis, 16 Okt · pagi". */
function itemOf(b: {
  startsAt: Date | null;
  endsAt: Date | null;
  unit: string | null;
  category: string;
  details: Record<string, unknown>;
}) {
  if (b.startsAt && b.endsAt)
    return `${b.unit ?? b.category} · ${formatSlot(b.startsAt, b.endsAt)}`;
  const { preferredDate, period } = b.details;
  if (typeof preferredDate !== 'string') return b.category;
  return [b.category, formatDay(fromJakarta(preferredDate, '12:00')), period]
    .filter(Boolean)
    .join(' · ');
}

/** "4 orang · sewa raket: ya · Keluhan: AC tidak dingin". Kunci details ditampilkan apa adanya. */
function detailsText(seats: number, details: Record<string, unknown>) {
  const parts = seats > 1 ? [`${seats} orang`] : [];
  for (const [k, v] of Object.entries(details)) {
    if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
    if (k === 'preferredDate' || k === 'period') continue; // sudah ada di item
    if (k === 'problem') parts.push(`Keluhan: ${v}`);
    else parts.push(`${k}: ${v === true ? 'ya' : v === false ? 'tidak' : String(v)}`);
  }
  return parts.join(' · ') || '-';
}

/** Pesan WA setelah status berubah. Mengembalikan hasil kirim yang berhasil (untuk tombol mode cadangan). */
async function notifyFor(
  id: number,
  to: BookingStatus,
  actor: Actor,
  reason?: string | null
): Promise<WaSendResult[]> {
  const i = await loadInfo(id);
  if (!i) return [];
  const citizen: WaRecipient | null = i.phone ? { phone: i.phone, role: 'citizen' } : null;
  const link = citizenLink(id);
  const why = reason?.trim() || 'Tidak disebutkan';
  const jobs: Promise<WaSendResult | null>[] = [];

  if (to === 'accepted') {
    if (i.providerPhone)
      jobs.push(
        send(
          'booking_contact',
          { phone: i.providerPhone, role: 'provider' },
          {
            code: i.code,
            name: i.name ?? '-',
            phone: i.phone ?? '-',
            address: i.address ?? '-',
            note: i.note ?? '-',
            // Tautan token: penyedia tanpa akun juga bisa membuka pesanan yang sudah diterimanya.
            link: providerLink(i.code)
          },
          id
        )
      );
    if (citizen)
      jobs.push(
        send(
          'booking_accepted',
          citizen,
          { code: i.code, listing: i.listing, item: itemOf(i), link },
          id
        )
      );
  } else if (to === 'cancelled') {
    // Beri tahu pihak yang TIDAK membatalkan.
    const item = itemOf(i);
    if (actor.kind === 'citizen') {
      if (i.providerPhone)
        jobs.push(
          send(
            'booking_cancelled',
            { phone: i.providerPhone, role: 'provider' },
            { code: i.code, listing: i.listing, item, reason: why, link: providerLink(i.code) },
            id
          )
        );
    } else if (citizen)
      jobs.push(
        send(
          'booking_cancelled',
          citizen,
          { code: i.code, listing: i.listing, item, reason: why, link },
          id
        )
      );
  } else if (citizen) {
    if (to === 'rejected')
      jobs.push(
        send(
          'booking_rejected',
          citizen,
          { code: i.code, listing: i.listing, reason: why, link },
          id
        )
      );
    else if (to === 'expired')
      jobs.push(send('booking_expired', citizen, { code: i.code, listing: i.listing, link }, id));
    else if (to === 'completed')
      jobs.push(send('review_request', citizen, { code: i.code, listing: i.listing, link }, id));
  }
  return (await Promise.all(jobs)).filter((n): n is WaSendResult => n !== null);
}

// ───────────────────────────── Transisi ─────────────────────────────

type Change = {
  to: BookingStatus;
  set?: Partial<typeof bookings.$inferInsert>;
  /** Pelaku yang dicatat bila berbeda dari pemanggil (mis. sistem yang mengedaluwarsakan). */
  as?: Actor;
  reason?: string | null;
};

/**
 * Kunci baris pesanan, tanyakan `decide` status tujuannya, lalu simpan perubahan + riwayat dalam satu transaksi.
 * UPDATE tetap bersyarat status lama, jadi aman dari balapan dengan expireStaleBookings.
 */
async function move(
  id: number,
  actor: Actor,
  reason: string | null,
  decide: (b: BookingRow, now: Date) => Fail | Change
): Promise<Fail | BookingStatus> {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(bookings).where(eq(bookings.id, id)).for('update');
    if (!b) return 'not_found';
    const d = decide(b, now);
    if (typeof d === 'string') return d;
    const who = d.as ?? actor;
    await tx
      .update(bookings)
      .set({ status: d.to, ...d.set })
      .where(and(eq(bookings.id, id), eq(bookings.status, b.status)));
    await tx.insert(bookingEvents).values({
      bookingId: id,
      fromStatus: b.status,
      toStatus: d.to,
      actor: who.kind,
      actorUserId: who.userId ?? null,
      reason: d.reason !== undefined ? d.reason : reason
    });
    return d.to;
  });
}

async function finish(
  id: number,
  r: Fail | BookingStatus,
  actor: Actor,
  reason?: string | null
): Promise<TransitionResult> {
  if (r === 'not_found' || r === 'invalid_transition' || r === 'too_late')
    return { ok: false, reason: r };
  return { ok: true, status: r, notices: await notifyFor(id, r, actor, reason) };
}

async function respondBooking(
  id: number,
  decision: 'accept' | 'reject',
  actor: Actor,
  reason?: string
): Promise<TransitionResult> {
  const why = reason?.trim() || null;
  const r = await move(id, actor, why, (b, now) => {
    if (b.status === 'expired') return 'too_late';
    if (b.status !== 'sent') return 'invalid_transition';
    if (b.respondBy && b.respondBy < now)
      return { to: 'expired', as: SYSTEM, reason: EXPIRED_REASON };
    return { to: decision === 'accept' ? 'accepted' : 'rejected', set: { respondedAt: now } };
  });
  if (r === 'expired') {
    await notifyFor(id, 'expired', SYSTEM);
    return { ok: false, reason: 'too_late' };
  }
  return finish(id, r, actor, why);
}

async function startBooking(id: number, actor: Actor) {
  const r = await move(id, actor, null, (b) =>
    b.status === 'accepted' ? { to: 'in_progress' } : 'invalid_transition'
  );
  return finish(id, r, actor);
}

async function completeBooking(id: number, actor: Actor) {
  const r = await move(id, actor, null, (b, now) =>
    b.status === 'accepted' || b.status === 'in_progress'
      ? { to: 'completed', set: { completedAt: now, reviewRequestedAt: now } }
      : 'invalid_transition'
  );
  return finish(id, r, actor);
}

async function cancelBooking(id: number, actor: Actor, reason: string) {
  const why = reason?.trim() || null;
  const r = await move(id, actor, why, (b, now) => {
    if (actor.kind === 'citizen') {
      if (b.citizenId !== actor.userId) return 'not_found';
      if (b.status === 'accepted') {
        // Aturan pembatalan yang disetujui warga saat memesan.
        const before = (b.rulesSnapshot as RulesSnapshot).cancelBeforeMinutes;
        if (b.startsAt && before && now.getTime() > b.startsAt.getTime() - before * 60_000)
          return 'too_late';
      } else if (b.status !== 'sent') return 'invalid_transition';
    } else if (!why || !['sent', 'accepted', 'in_progress'].includes(b.status)) {
      // Penyedia dan admin wajib memberi alasan.
      return 'invalid_transition';
    }
    return { to: 'cancelled', set: { cancelledAt: now } };
  });
  return finish(id, r, actor, why);
}

async function expireStaleBookings(now = new Date()) {
  const ids = await db.transaction(async (tx) => {
    const rows = await tx
      .update(bookings)
      .set({ status: 'expired' })
      .where(and(eq(bookings.status, 'sent'), lt(bookings.respondBy, now)))
      .returning({ id: bookings.id });
    if (rows.length)
      await tx.insert(bookingEvents).values(
        rows.map((r) => ({
          bookingId: r.id,
          fromStatus: 'sent' as const,
          toStatus: 'expired' as const,
          actor: 'system' as const,
          reason: EXPIRED_REASON
        }))
      );
    return rows.map((r) => r.id);
  });
  for (const id of ids) await notifyFor(id, 'expired', SYSTEM);
  return { expired: ids };
}

async function runReminders(now = new Date()) {
  let sent = 0;
  const tally = (n: WaSendResult | null | WaSendResult[]) => {
    sent += Array.isArray(n) ? n.length : n ? 1 : 0;
  };

  // 1. Penyedia belum menjawab dan separuh batas waktu sudah lewat. Tanda dipasang dulu: paling banyak sekali kirim.
  const late = await db
    .update(bookings)
    .set({ providerRemindedAt: now })
    .where(
      and(
        eq(bookings.status, 'sent'),
        isNull(bookings.providerRemindedAt),
        gt(bookings.respondBy, now),
        sql`${bookings.createdAt} + (${bookings.respondBy} - ${bookings.createdAt}) / 2 <= ${now}`
      )
    )
    .returning({ id: bookings.id, respondBy: bookings.respondBy });
  for (const b of late) {
    const i = await loadInfo(b.id);
    if (!i?.providerPhone || !b.respondBy) continue;
    tally(
      await send(
        'booking_reminder_provider',
        { phone: i.providerPhone, role: 'provider' },
        {
          code: i.code,
          listing: i.listing,
          item: itemOf(i),
          minutesLeft: Math.max(1, Math.ceil((b.respondBy.getTime() - now.getTime()) / 60_000)),
          link: providerLink(i.code)
        },
        b.id
      )
    );
  }

  // 2. Warga: pengingat sebelum jadwal.
  const before = await getSetting('booking.reminder_minutes_before');
  const soon = await db
    .update(bookings)
    .set({ remindedAt: now })
    .where(
      and(
        eq(bookings.status, 'accepted'),
        isNull(bookings.remindedAt),
        gt(bookings.startsAt, now),
        lte(bookings.startsAt, new Date(now.getTime() + before * 60_000))
      )
    )
    .returning({ id: bookings.id });
  for (const b of soon) {
    const i = await loadInfo(b.id);
    if (!i?.phone) continue;
    tally(
      await send(
        'booking_reminder',
        { phone: i.phone, role: 'citizen' },
        { code: i.code, listing: i.listing, item: itemOf(i), link: citizenLink(b.id) },
        b.id
      )
    );
  }

  // 3. Selesai otomatis: jadwal sudah lewat 2 jam, lalu "Puas?".
  const done = await db.transaction(async (tx) => {
    const ids: number[] = [];
    for (const from of ['accepted', 'in_progress'] as const) {
      const rows = await tx
        .update(bookings)
        .set({ status: 'completed', completedAt: now, reviewRequestedAt: now })
        .where(
          and(
            eq(bookings.status, from),
            lt(bookings.endsAt, new Date(now.getTime() - AUTO_COMPLETE_MS))
          )
        )
        .returning({ id: bookings.id });
      if (rows.length)
        await tx.insert(bookingEvents).values(
          rows.map((r) => ({
            bookingId: r.id,
            fromStatus: from,
            toStatus: 'completed' as const,
            actor: 'system' as const,
            reason: 'Selesai otomatis setelah jadwal lewat'
          }))
        );
      ids.push(...rows.map((r) => r.id));
    }
    return ids;
  });
  for (const id of done) tally(await notifyFor(id, 'completed', SYSTEM));

  return { sent };
}

// ───────────────────────────── Membuat pesanan ─────────────────────────────

function validRequest(r: CreateBookingInput['request']) {
  if (!r?.problem?.trim() || !PERIODS.includes(r.period)) return false;
  const d = fromJakarta(r.preferredDate ?? '', '12:00');
  return !Number.isNaN(d.getTime()) && jakartaDate(d) === r.preferredDate;
}

const fail = (reason: CreateBookingFail) => ({ ok: false as const, reason });

async function createBooking(input: CreateBookingInput) {
  const [l] = await db
    .select({
      kind: listings.kind,
      status: listings.status,
      verification: listings.verificationLevel,
      whatsapp: listings.whatsapp,
      name: listings.name,
      priceMin: listings.priceMin,
      category: categories.name,
      categoryActive: categories.isActive,
      scheduleKind: categories.scheduleKind,
      responseMinutes: categories.responseMinutes,
      door: doors.name,
      doorStatus: doors.status
    })
    .from(listings)
    .innerJoin(
      listingCategories,
      and(
        eq(listingCategories.listingId, listings.id),
        eq(listingCategories.categoryId, input.categoryId)
      )
    )
    .innerJoin(categories, eq(categories.id, listingCategories.categoryId))
    .leftJoin(doors, eq(doors.id, categories.doorId))
    .where(eq(listings.id, input.listingId));
  if (
    !l ||
    l.kind !== 'provider' ||
    l.status !== 'published' ||
    !l.categoryActive ||
    l.doorStatus !== 'active' ||
    !BOOKABLE_KINDS.includes(l.scheduleKind)
  )
    return fail('listing_unavailable');
  if (l.verification === 'unverified') return fail('not_verified');
  if (!l.whatsapp) return fail('no_whatsapp');

  const slot = l.scheduleKind === 'none' ? undefined : input.slot;
  if (l.scheduleKind !== 'none' && !slot) return fail('needs_slot');
  const request = slot ? undefined : input.request;
  if (!slot && !validRequest(request)) return fail('needs_request');

  const seats = slot?.seats ?? input.seats ?? 1;
  const details = { ...input.details, ...request };
  const [district] = input.districtId
    ? await db
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(eq(locations.id, input.districtId))
    : [];
  const respondMinutes =
    l.responseMinutes ?? (await getSetting('booking.default_response_minutes'));

  let created;
  try {
    created = await db.transaction(async (tx) => {
      let price = l.priceMin;
      let exclusive = true;
      let unit: string | null = null;
      if (slot) {
        const [u] = await tx
          .select({ name: units.name })
          .from(units)
          .where(and(eq(units.id, slot.unitId), eq(units.listingId, input.listingId)));
        if (!u) return fail('needs_slot');
        const hold = await schedule.holdSlot(tx, { ...slot, seats });
        if (!hold.ok) return fail(hold.reason);
        ({ price, exclusive } = hold);
        unit = u.name;
      }

      const now = new Date();
      let row: { id: number; code: string } | undefined;
      // Kode bentrok (sangat jarang) → coba kode lain. Bentrok slot tetap melempar 23P01.
      for (let i = 0; !row && i < 5; i++) {
        const code = newCode();
        [row] = await tx
          .insert(bookings)
          .values({
            code,
            citizenId: input.citizenId,
            listingId: input.listingId,
            categoryId: input.categoryId,
            unitId: slot?.unitId ?? null,
            status: 'sent',
            startsAt: slot?.startsAt ?? null,
            endsAt: slot?.endsAt ?? null,
            seats,
            exclusive,
            districtId: district?.id ?? null,
            details,
            rulesSnapshot: input.rulesAccepted ?? {},
            price,
            respondBy: new Date(now.getTime() + respondMinutes * 60_000),
            providerTokenHash: sha256(providerToken(code))
          })
          .onConflictDoNothing({ target: bookings.code })
          .returning({ id: bookings.id, code: bookings.code });
      }
      if (!row) throw new Error('Mesin Pesanan: gagal membuat kode pesanan unik');

      const c = input.contact;
      await tx.insert(bookingContacts).values({
        bookingId: row.id,
        name: c.name,
        phone: c.phone,
        address: c.address ?? null,
        lat: c.point?.lat ?? null,
        lng: c.point?.lng ?? null,
        note: c.note ?? null
      });
      await tx.insert(bookingEvents).values({
        bookingId: row.id,
        fromStatus: null,
        toStatus: 'sent',
        actor: 'citizen',
        actorUserId: input.citizenId
      });
      return {
        ok: true as const,
        ...row,
        startsAt: slot?.startsAt ?? null,
        endsAt: slot?.endsAt ?? null,
        unit
      };
    });
  } catch (e) {
    // Exclusion constraint bookings_no_overlap: slot sudah diambil pesanan lain.
    if (pgCode(e) === '23P01') return fail('taken');
    throw e;
  }
  if (!created.ok) return created;

  // Setelah commit: pesanan baru ke penyedia. Tanpa kontak warga, hanya kecamatan.
  const providerNotice = await notify.sendWa(
    'booking_new',
    { phone: l.whatsapp, role: 'provider' },
    {
      code: created.code,
      door: l.door ?? '-',
      listing: l.name,
      item: itemOf({ ...created, category: l.category, details }),
      details: detailsText(seats, details),
      district: district?.name ?? '-',
      respondMinutes,
      link: providerLink(created.code)
    },
    { bookingId: created.id }
  );
  return { ok: true as const, bookingId: created.id, code: created.code, providerNotice };
}

// ───────────────────────────── Membaca pesanan ─────────────────────────────

function viewQuery() {
  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      listingId: listings.id,
      listingSlug: listings.slug,
      listingName: listings.name,
      listingWhatsapp: listings.whatsapp,
      categoryId: categories.id,
      categoryName: categories.name,
      scheduleKind: categories.scheduleKind,
      doorSlug: doors.slug,
      unitId: units.id,
      unitName: units.name,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      seats: bookings.seats,
      district: locations.name,
      details: bookings.details,
      rulesSnapshot: bookings.rulesSnapshot,
      price: bookings.price,
      respondBy: bookings.respondBy,
      createdAt: bookings.createdAt
    })
    .from(bookings)
    .innerJoin(listings, eq(listings.id, bookings.listingId))
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .leftJoin(doors, eq(doors.id, categories.doorId))
    .leftJoin(units, eq(units.id, bookings.unitId))
    .leftJoin(locations, eq(locations.id, bookings.districtId));
}
type ViewRow = Awaited<ReturnType<typeof viewQuery>>[number];

/** Baris → BookingView (tanpa kontak), riwayat dan ulasan diambil sekaligus untuk semua baris. */
async function toViews(rows: ViewRow[]): Promise<BookingView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [events, revs] = await Promise.all([
    db
      .select()
      .from(bookingEvents)
      .where(inArray(bookingEvents.bookingId, ids))
      .orderBy(asc(bookingEvents.createdAt), asc(bookingEvents.id)),
    db.select().from(reviews).where(inArray(reviews.bookingId, ids))
  ]);
  return rows.map((r) => {
    const review = revs.find((v) => v.bookingId === r.id);
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      listing: {
        id: r.listingId,
        slug: r.listingSlug,
        name: r.listingName,
        whatsapp: r.listingWhatsapp
      },
      category: {
        id: r.categoryId,
        name: r.categoryName,
        doorSlug: r.doorSlug,
        scheduleKind: r.scheduleKind
      },
      unit: r.unitId ? { id: r.unitId, name: r.unitName ?? '' } : null,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      seats: r.seats,
      district: r.district,
      details: r.details,
      rulesSnapshot: r.rulesSnapshot as RulesSnapshot,
      price: r.price,
      respondBy: r.respondBy,
      createdAt: r.createdAt,
      events: events
        .filter((e) => e.bookingId === r.id)
        .map((e) => ({
          fromStatus: e.fromStatus,
          toStatus: e.toStatus,
          actor: e.actor,
          reason: e.reason,
          at: e.createdAt
        })),
      review: review
        ? { satisfied: review.satisfied, stars: review.stars, comment: review.comment }
        : null
    };
  });
}

/** Tambah kontak warga. Tanpa `always`, kontak hanya dibuka setelah pesanan diterima (aturan privasi). */
async function withContact(
  view: BookingView | undefined,
  always = false
): Promise<ProviderBookingView | null> {
  if (!view) return null;
  if (!always && !CONTACT_OPEN.includes(view.status)) return { ...view, contact: null };
  const [c] = await db.select().from(bookingContacts).where(eq(bookingContacts.bookingId, view.id));
  return {
    ...view,
    contact: c
      ? {
          name: c.name,
          phone: c.phone,
          address: c.address,
          point: c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng } : null,
          note: c.note
        }
      : null
  };
}

async function getBookingForProvider(access: ProviderAccess) {
  await expireStaleBookings();
  const where =
    'token' in access
      ? eq(bookings.providerTokenHash, sha256(access.token))
      : and(eq(bookings.id, access.bookingId), eq(listings.ownerId, access.userId));
  const rows = await viewQuery().where(where);
  return withContact((await toViews(rows))[0]);
}

async function getBookingForCitizen(bookingId: number, citizenId: string) {
  await expireStaleBookings();
  const rows = await viewQuery().where(
    and(eq(bookings.id, bookingId), eq(bookings.citizenId, citizenId))
  );
  return (await toViews(rows))[0] ?? null;
}

async function getBookingForAdmin(bookingId: number) {
  await expireStaleBookings();
  const rows = await viewQuery().where(eq(bookings.id, bookingId));
  return withContact((await toViews(rows))[0], true);
}

async function listBookings(f: BookingListFilter) {
  await expireStaleBookings();
  if (f.listingIds?.length === 0 || f.status?.length === 0) return { items: [], total: 0 };
  // Waktu pesanan: jadwalnya, atau waktu dibuat untuk permintaan tanpa jadwal.
  const when = sql`coalesce(${bookings.startsAt}, ${bookings.createdAt})`;
  const where = and(
    f.listingIds ? inArray(bookings.listingId, f.listingIds) : undefined,
    f.citizenId !== undefined ? eq(bookings.citizenId, f.citizenId) : undefined,
    f.status ? inArray(bookings.status, f.status) : undefined,
    f.from ? gte(when, f.from) : undefined,
    f.to ? lt(when, f.to) : undefined
  );
  const [rows, [{ total }]] = await Promise.all([
    viewQuery()
      .where(where)
      .orderBy(desc(bookings.createdAt), desc(bookings.id))
      .limit(f.limit ?? 50)
      .offset(f.offset ?? 0),
    db.select({ total: count() }).from(bookings).where(where)
  ]);
  return { items: await toViews(rows), total };
}

/** Penyedia lain yang bisa dipesan (aturan sama dengan createBooking), kecamatan lalu kota yang sama lebih dulu. */
async function findAlternatives(bookingId: number, limit = 3) {
  const res = await db.execute(sql`
    with b as (
      select b.listing_id, b.category_id, coalesce(b.district_id, l.location_id) as loc
      from bookings b join listings l on l.id = b.listing_id
      where b.id = ${bookingId}
    )
    select l.id, l.slug, l.name
    from b
    join categories c on c.id = b.category_id
    join doors d on d.id = c.door_id
    join listing_categories lc on lc.category_id = b.category_id
    join listings l on l.id = lc.listing_id
    left join locations ll on ll.id = l.location_id
    left join locations bl on bl.id = b.loc
    where l.id <> b.listing_id
      and l.kind = 'provider' and l.status = 'published'
      and l.verification_level <> 'unverified' and l.whatsapp is not null
      and d.status = 'active' and c.is_active and c.schedule_kind in ('slot', 'seat', 'none')
      and (c.schedule_kind = 'none'
        or exists (select 1 from units u where u.listing_id = l.id and u.is_active))
    order by
      case
        when l.location_id = bl.id then 0
        -- ponytail: kota dihitung dari level city/district saja; kelurahan dianggap di luar kota.
        when (case ll.level when 'city' then ll.id when 'district' then ll.parent_id end)
           = (case bl.level when 'city' then bl.id when 'district' then bl.parent_id end) then 1
        else 2
      end,
      l.verification_level desc,
      l.name
    limit ${limit}
  `);
  return (res.rows as { id: number; slug: string; name: string }[]).map((r) => ({
    listingId: Number(r.id),
    slug: r.slug,
    name: r.name
  }));
}

async function submitReview(
  bookingId: number,
  citizenId: string,
  input: { satisfied: boolean; stars?: number | null; comment?: string | null }
) {
  const [b] = await db
    .select({ status: bookings.status, listingId: bookings.listingId })
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.citizenId, citizenId)));
  if (!b) return { ok: false as const, reason: 'not_found' as const };
  if (b.status !== 'completed') return { ok: false as const, reason: 'not_completed' as const };
  const rows = await db
    .insert(reviews)
    .values({
      bookingId,
      listingId: b.listingId,
      citizenId,
      satisfied: input.satisfied,
      stars: input.stars ?? null,
      comment: input.comment?.trim() || null
    })
    .onConflictDoNothing({ target: reviews.bookingId })
    .returning({ id: reviews.id });
  return rows.length
    ? { ok: true as const }
    : { ok: false as const, reason: 'already_reviewed' as const };
}

/** Kirim ulang `booking_new` (tautan token sama) untuk pesanan yang masih menunggu jawaban. */
async function resendProviderNotice(id: number) {
  const [r] = await db
    .select({
      status: bookings.status,
      seats: bookings.seats,
      respondBy: bookings.respondBy,
      door: doors.name,
      district: locations.name
    })
    .from(bookings)
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .leftJoin(doors, eq(doors.id, categories.doorId))
    .leftJoin(locations, eq(locations.id, bookings.districtId))
    .where(eq(bookings.id, id));
  const i = r && (await loadInfo(id));
  if (!r || !i) return { ok: false as const, reason: 'not_found' as const };
  if (r.status !== 'sent' || !i.providerPhone)
    return { ok: false as const, reason: 'invalid_transition' as const };
  const left = r.respondBy ? Math.ceil((r.respondBy.getTime() - Date.now()) / 60_000) : 0;
  const notice = await notify.sendWa(
    'booking_new',
    { phone: i.providerPhone, role: 'provider' },
    {
      code: i.code,
      door: r.door ?? '-',
      listing: i.listing,
      item: itemOf(i),
      details: detailsText(r.seats, i.details),
      district: r.district ?? '-',
      respondMinutes: Math.max(left, 1),
      link: providerLink(i.code)
    },
    { bookingId: id }
  );
  return { ok: true as const, notice };
}

export const bookingEngine: BookingEngine = {
  createBooking,
  resendProviderNotice,
  respondBooking,
  startBooking,
  completeBooking,
  cancelBooking,
  expireStaleBookings,
  runReminders,
  getBookingForProvider,
  getBookingForCitizen,
  getBookingForAdmin,
  listBookings,
  findAlternatives,
  submitReview
};
