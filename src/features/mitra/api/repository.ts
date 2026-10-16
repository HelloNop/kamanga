// Logika database dashboard mitra. TANPA pemeriksaan login: hanya diimpor service.ts dan uji.
// Setiap fungsi yang menerima listingId WAJIB membatasi baris anak (unit, pengecualian, blokir, tanya jawab)
// ke listing itu, sehingga id milik usaha lain dianggap tidak ada. Masukan dari klien divalidasi Zod di sini.
// Kontak warga TIDAK pernah dibaca dari sini; pesanan lengkap selalu lewat booking.getBookingForProvider.
import { and, asc, eq, gt, gte, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  categories,
  listingCategories,
  listingQa,
  listings,
  locations,
  reviews,
  scheduleExceptions,
  scheduleRules,
  slotBlocks,
  units,
  user
} from '@/db/schema';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import {
  ACTIVE_BOOKING_STATUSES,
  type Actor,
  appUrl,
  notify,
  paths,
  schedule
} from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { bookingItem, timed } from '../lib/format';
import {
  answerSchema,
  blockSchema,
  exceptionSchema,
  expandPatterns,
  groupRules,
  qaSchema,
  rulesFormSchema,
  unitSchema
} from '../schemas';
import type {
  AnswerResult,
  CalendarSlot,
  Fail,
  MonthSummary,
  OwnedListing,
  QaData,
  ReviewsData,
  ScheduleEditorData,
  StatsData,
  Viewer
} from './types';

const fail = (message: string): Fail => ({ ok: false, message });
const firstIssue = (e: { issues: { message: string }[] }) =>
  fail(e.issues[0]?.message ?? 'Isian tidak valid');
const DAY = 86_400_000;

// ───────────────────────────── Usaha dan hak akses ─────────────────────────────

const primaryCategory = and(
  eq(listingCategories.listingId, listings.id),
  eq(listingCategories.isPrimary, true)
);

/** Usaha milik mitra (tanpa yang diarsipkan), untuk pemilih usaha. */
export async function ownedListings(userId: string): Promise<OwnedListing[]> {
  return db
    .select({
      id: listings.id,
      name: listings.name,
      slug: listings.slug,
      status: listings.status,
      scheduleKind: categories.scheduleKind,
      categoryName: categories.name
    })
    .from(listings)
    .leftJoin(listingCategories, primaryCategory)
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .where(and(eq(listings.ownerId, userId), ne(listings.status, 'archived')))
    .orderBy(asc(listings.name), asc(listings.id));
}

async function listingInfo(listingId: number) {
  const [l] = await db
    .select({
      id: listings.id,
      name: listings.name,
      slug: listings.slug,
      ownerId: listings.ownerId,
      attributes: listings.attributes,
      scheduleKind: categories.scheduleKind,
      attributeSchema: categories.attributeSchema
    })
    .from(listings)
    .leftJoin(listingCategories, primaryCategory)
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .where(eq(listings.id, listingId));
  return l ?? null;
}

/** Admin boleh mengubah semua usaha; mitra hanya usaha miliknya. */
export async function canEdit(viewer: Viewer, listingId: number) {
  const [l] = await db
    .select({ ownerId: listings.ownerId })
    .from(listings)
    .where(eq(listings.id, listingId));
  if (!l) return false;
  return viewer.role === 'admin' || (viewer.role === 'vendor' && l.ownerId === viewer.id);
}

export const isOwner = (userId: string, listingId: number) =>
  canEdit({ id: userId, role: 'vendor' }, listingId);

/** Unit milik listing ini (null bila unit milik usaha lain / tidak ada). */
async function unitOf(listingId: number, unitId: number) {
  const [u] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.listingId, listingId)));
  return u ?? null;
}

/** Label isian aturan kategori yang belum diisi. */
export async function missingAttributes(listingId: number) {
  const l = await listingInfo(listingId);
  if (!l) return [];
  return parseAttributeSchema(l.attributeSchema)
    .filter((a) => {
      const v = l.attributes[a.key];
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    })
    .map((a) => a.label);
}

// ───────────────────────────── Jadwal ─────────────────────────────

export async function scheduleEditorData(
  listingId: number,
  viewer: 'admin' | 'vendor'
): Promise<ScheduleEditorData | null> {
  const l = await listingInfo(listingId);
  if (!l) return null;
  const unitRows = await db
    .select()
    .from(units)
    .where(eq(units.listingId, listingId))
    .orderBy(asc(units.sortOrder), asc(units.id));
  const ids = unitRows.map((u) => u.id);
  const ruleRows = ids.length
    ? await db.select().from(scheduleRules).where(inArray(scheduleRules.unitId, ids))
    : [];
  const exceptions = await db
    .select({
      id: scheduleExceptions.id,
      date: scheduleExceptions.date,
      unitId: scheduleExceptions.unitId,
      isClosed: scheduleExceptions.isClosed,
      startTime: scheduleExceptions.startTime,
      endTime: scheduleExceptions.endTime,
      note: scheduleExceptions.note
    })
    .from(scheduleExceptions)
    .where(
      and(
        eq(scheduleExceptions.listingId, listingId),
        gte(scheduleExceptions.date, jakartaDate(new Date()))
      )
    )
    .orderBy(asc(scheduleExceptions.date), asc(scheduleExceptions.id));
  const conflicts = timed(l.scheduleKind) ? await schedule.findConflicts(listingId) : [];
  const cities =
    l.scheduleKind === 'seat'
      ? await db
          .select({ id: locations.id, name: locations.name })
          .from(locations)
          .where(eq(locations.level, 'city'))
          .orderBy(asc(locations.name))
      : [];
  const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
  return {
    listing: { id: l.id, name: l.name, scheduleKind: l.scheduleKind },
    viewer,
    units: unitRows.map((u) => ({
      id: u.id,
      name: u.name,
      capacity: u.capacity,
      originLocationId: u.originLocationId,
      destinationLocationId: u.destinationLocationId,
      isActive: u.isActive,
      patterns: groupRules(ruleRows.filter((r) => r.unitId === u.id))
    })),
    exceptions: exceptions.map((e) => ({
      ...e,
      startTime: e.startTime?.slice(0, 5) ?? null,
      endTime: e.endTime?.slice(0, 5) ?? null
    })),
    conflicts: conflicts.map((c) => ({
      ...c,
      unitName: unitName.get(c.unitId) ?? '',
      href: viewer === 'vendor' ? paths.providerBooking(c.bookingId) : null
    })),
    cities
  };
}

export async function saveUnit(listingId: number, unitId: number | null, input: unknown) {
  const p = unitSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const l = await listingInfo(listingId);
  if (!l || !timed(l.scheduleKind)) return fail('Usaha ini tidak memakai jadwal.');
  const seat = l.scheduleKind === 'seat';
  const route = [p.data.originLocationId, p.data.destinationLocationId].map((v) =>
    seat && v ? Number(v) : null
  );
  const known = route.filter((v): v is number => v !== null);
  if (known.length) {
    const found = await db
      .select({ id: locations.id })
      .from(locations)
      .where(inArray(locations.id, known));
    if (found.length !== new Set(known).size) return fail('Kota asal/tujuan tidak dikenal.');
  }
  const values = {
    name: p.data.name,
    capacity: seat ? p.data.capacity : 1,
    originLocationId: route[0],
    destinationLocationId: route[1]
  };
  if (unitId !== null) {
    const rows = await db
      .update(units)
      .set(values)
      .where(and(eq(units.id, unitId), eq(units.listingId, listingId)))
      .returning({ id: units.id });
    return rows.length ? { ok: true as const, id: unitId } : fail('Unit tidak ditemukan.');
  }
  const [row] = await db
    .insert(units)
    .values({
      ...values,
      listingId,
      sortOrder: sql`(select coalesce(max(${units.sortOrder}) + 1, 0) from ${units} where ${units.listingId} = ${listingId})`
    })
    .returning({ id: units.id });
  return { ok: true as const, id: row.id };
}

/** Nonaktifkan / aktifkan unit. Pesanan yang sudah ada tidak dihapus (tampil sebagai konflik). */
export async function setUnitActive(listingId: number, unitId: number, active: boolean) {
  const rows = await db
    .update(units)
    .set({ isActive: active })
    .where(and(eq(units.id, unitId), eq(units.listingId, listingId)))
    .returning({ id: units.id });
  return rows.length ? { ok: true as const } : fail('Unit tidak ditemukan.');
}

/** Ganti seluruh jam buka satu unit. Pesanan tidak disentuh; bentrok ditampilkan lewat findConflicts. */
export async function replaceRules(listingId: number, unitId: number, patterns: unknown) {
  const l = await listingInfo(listingId);
  if (!l || !timed(l.scheduleKind)) return fail('Usaha ini tidak memakai jadwal.');
  const kind = l.scheduleKind as 'slot' | 'seat';
  const p = rulesFormSchema(kind).safeParse({ patterns });
  if (!p.success) return firstIssue(p.error);
  const rows = expandPatterns(kind, p.data.patterns);
  return db.transaction(async (tx) => {
    // Kunci unit: sama dengan holdSlot/blockSlot, jadi tidak balapan dengan pesanan yang sedang dibuat.
    const [u] = await tx
      .select({ id: units.id })
      .from(units)
      .where(and(eq(units.id, unitId), eq(units.listingId, listingId)))
      .for('update');
    if (!u) return fail('Unit tidak ditemukan.');
    await tx.delete(scheduleRules).where(eq(scheduleRules.unitId, unitId));
    if (rows.length) await tx.insert(scheduleRules).values(rows.map((r) => ({ ...r, unitId })));
    return { ok: true as const };
  });
}

/** Libur / jam khusus. Pengecualian lama di tanggal + unit yang sama diganti. */
export async function saveException(listingId: number, input: unknown) {
  const p = exceptionSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const v = p.data;
  if (v.date < jakartaDate(new Date())) return fail('Tanggal sudah lewat.');
  const unitId = v.unitId ? Number(v.unitId) : null;
  if (unitId !== null && !(await unitOf(listingId, unitId))) return fail('Unit tidak ditemukan.');
  const [l] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId));
  if (!l) return fail('Usaha tidak ditemukan.');
  await db.transaction(async (tx) => {
    await tx
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.listingId, listingId),
          eq(scheduleExceptions.date, v.date),
          unitId === null
            ? isNull(scheduleExceptions.unitId)
            : eq(scheduleExceptions.unitId, unitId)
        )
      );
    await tx.insert(scheduleExceptions).values({
      listingId,
      unitId,
      date: v.date,
      isClosed: v.closed,
      startTime: v.closed ? null : v.start,
      endTime: v.closed ? null : v.end,
      note: v.note || null
    });
  });
  return { ok: true as const };
}

export async function deleteException(listingId: number, id: number) {
  const rows = await db
    .delete(scheduleExceptions)
    .where(and(eq(scheduleExceptions.id, id), eq(scheduleExceptions.listingId, listingId)))
    .returning({ id: scheduleExceptions.id });
  return rows.length ? { ok: true as const } : fail('Pengecualian tidak ditemukan.');
}

/** Kalender satu unit pada satu tanggal WIB: semua slot (kosong/ditahan/dipesan/diblokir) + blokir + pesanan. */
export async function calendar(
  listingId: number,
  unitId: number,
  date: string,
  viewer: 'admin' | 'vendor'
): Promise<CalendarSlot[] | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(await unitOf(listingId, unitId))) return null;
  const l = await listingInfo(listingId);
  const seat = l?.scheduleKind === 'seat';
  const from = fromJakarta(date, '00:00');
  const to = fromJakarta(addDays(date, 1), '00:00');
  const slots = await schedule.getAvailability({ unitIds: [unitId], from, to, includeTaken: true });
  // Slot yang dimulai hari ini boleh berakhir besok (lewat tengah malam / perjalanan).
  const horizon = new Date(to.getTime() + DAY);
  const blocks = await db
    .select()
    .from(slotBlocks)
    .where(
      and(
        eq(slotBlocks.unitId, unitId),
        lt(slotBlocks.startsAt, horizon),
        gt(slotBlocks.endsAt, from)
      )
    );
  const active = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      seats: bookings.seats,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.unitId, unitId),
        inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]),
        lt(bookings.startsAt, horizon),
        gt(bookings.endsAt, from)
      )
    );
  // Sama dengan mesin Jadwal: keberangkatan travel kena bila jam berangkatnya di dalam rentang.
  const hits = (aS: number, aE: number, s: number, e: number) =>
    seat ? aS <= s && s < aE : aS < e && s < aE;
  return slots.map((s) => {
    const S = s.startsAt.getTime();
    const E = s.endsAt.getTime();
    const b =
      s.state === 'blocked'
        ? blocks.find((x) => hits(x.startsAt.getTime(), x.endsAt.getTime(), S, E))
        : undefined;
    return {
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      state: s.state,
      price: s.price,
      isPeak: s.isPeak,
      capacity: s.capacity,
      seatsLeft: s.seatsLeft,
      block: b ? { id: b.id, reason: b.reason, note: b.note } : null,
      bookings: active
        .filter((x) =>
          seat ? x.startsAt!.getTime() === S : x.startsAt!.getTime() < E && S < x.endsAt!.getTime()
        )
        .map(({ id, code, status, seats }) => ({
          id,
          code,
          status,
          seats,
          href: viewer === 'vendor' ? paths.providerBooking(id) : null
        }))
    };
  });
}

/** Blokir manual. Travel: satu keberangkatan = rentang [jam berangkat, +1 menit). */
export async function blockSlot(listingId: number, input: unknown, actor: Actor) {
  const p = blockSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const v = p.data;
  const l = await listingInfo(listingId);
  if (!l || !timed(l.scheduleKind)) return fail('Usaha ini tidak memakai jadwal.');
  if (!(await unitOf(listingId, v.unitId))) return fail('Unit tidak ditemukan.');
  const endsAt = l.scheduleKind === 'seat' ? new Date(v.startsAt.getTime() + 60_000) : v.endsAt;
  if (endsAt.getTime() <= Date.now()) return fail('Waktunya sudah lewat.');
  const r = await schedule.blockSlot({
    unitId: v.unitId,
    startsAt: v.startsAt,
    endsAt,
    reason: v.reason,
    note: v.note || null,
    actor
  });
  if (r.ok) return { ok: true as const, id: r.id };
  return fail(
    r.reason === 'conflict'
      ? 'Sudah ada pesanan di waktu ini, jadi tidak bisa diblokir.'
      : 'Waktu ini sudah diblokir atau tidak valid.'
  );
}

export async function unblockSlot(listingId: number, blockId: number, actor: Actor) {
  const [b] = await db
    .select({ id: slotBlocks.id })
    .from(slotBlocks)
    .innerJoin(units, eq(units.id, slotBlocks.unitId))
    .where(and(eq(slotBlocks.id, blockId), eq(units.listingId, listingId)));
  if (!b) return fail('Blokir tidak ditemukan.');
  await schedule.unblockSlot(blockId, actor);
  return { ok: true as const };
}

// ───────────────────────────── Tanya jawab ─────────────────────────────

const qaCols = {
  id: listingQa.id,
  question: listingQa.question,
  answer: listingQa.answer,
  source: listingQa.source,
  createdAt: listingQa.createdAt
};
const nextQaOrder = (listingId: number) =>
  sql`(select coalesce(max(${listingQa.sortOrder}) + 1, 0) from ${listingQa} where ${listingQa.listingId} = ${listingId})`;

export async function qaData(
  listingId: number,
  viewer: 'admin' | 'vendor'
): Promise<QaData | null> {
  const l = await listingInfo(listingId);
  if (!l) return null;
  const rows = await db
    .select(qaCols)
    .from(listingQa)
    .where(eq(listingQa.listingId, listingId))
    .orderBy(asc(listingQa.sortOrder), asc(listingQa.id));
  return {
    listing: { id: l.id, name: l.name, slug: l.slug },
    viewer,
    pending: rows
      .filter((r) => r.answer === null)
      .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    items: rows.filter((r) => r.answer !== null)
  };
}

export async function pendingQuestionCount(listingId: number) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listingQa)
    .where(and(eq(listingQa.listingId, listingId), isNull(listingQa.answer)));
  return r.n;
}

/** Tambah (id null) atau ubah tanya jawab yang sudah tampil. Pertanyaan warga dijawab lewat answerQuestion. */
export async function saveQa(listingId: number, id: number | null, input: unknown) {
  const p = qaSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  if (id !== null) {
    const rows = await db
      .update(listingQa)
      .set(p.data)
      .where(
        and(
          eq(listingQa.id, id),
          eq(listingQa.listingId, listingId),
          sql`${listingQa.answer} is not null`
        )
      )
      .returning({ id: listingQa.id });
    return rows.length ? { ok: true as const } : fail('Tanya jawab tidak ditemukan.');
  }
  const [l] = await db.select({ id: listings.id }).from(listings).where(eq(listings.id, listingId));
  if (!l) return fail('Usaha tidak ditemukan.');
  await db.insert(listingQa).values({
    listingId,
    ...p.data,
    source: 'provider',
    answeredAt: new Date(),
    sortOrder: nextQaOrder(listingId)
  });
  return { ok: true as const };
}

export async function deleteQa(listingId: number, id: number) {
  const rows = await db
    .delete(listingQa)
    .where(and(eq(listingQa.id, id), eq(listingQa.listingId, listingId)))
    .returning({ id: listingQa.id });
  return rows.length ? { ok: true as const } : fail('Tanya jawab tidak ditemukan.');
}

/** Geser satu tanya jawab naik (-1) / turun (1), lalu nomori ulang urutannya. */
export async function moveQa(listingId: number, id: number, dir: -1 | 1) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: listingQa.id })
      .from(listingQa)
      .where(and(eq(listingQa.listingId, listingId), sql`${listingQa.answer} is not null`))
      .orderBy(asc(listingQa.sortOrder), asc(listingQa.id))
      .for('update');
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return fail('Tanya jawab tidak ditemukan.');
    const j = i + dir;
    if (j < 0 || j >= rows.length) return { ok: true as const };
    [rows[i], rows[j]] = [rows[j], rows[i]];
    for (const [n, r] of rows.entries())
      await tx.update(listingQa).set({ sortOrder: n }).where(eq(listingQa.id, r.id));
    return { ok: true as const };
  });
}

/**
 * Jawab pertanyaan warga: simpan jawaban, lalu kabari penanya (warga ber-nomor WA) lewat mesin Notifikasi.
 * Tautan cadangan wa.me memuat nomor warga, jadi hanya dikembalikan untuk admin (tim mengirim dari nomor resmi);
 * mitra tidak boleh melihat nomor warga (aturan privasi).
 */
export async function answerQuestion(
  listingId: number,
  id: number,
  input: unknown,
  viewer: 'admin' | 'vendor'
): Promise<AnswerResult> {
  const p = answerSchema.safeParse(input);
  if (!p.success) return firstIssue(p.error);
  const [row] = await db
    .update(listingQa)
    .set({ answer: p.data.answer, answeredAt: new Date(), sortOrder: nextQaOrder(listingId) })
    .where(and(eq(listingQa.id, id), eq(listingQa.listingId, listingId), isNull(listingQa.answer)))
    .returning({ askedBy: listingQa.askedBy, question: listingQa.question });
  if (!row) return fail('Pertanyaan tidak ditemukan atau sudah dijawab.');
  const [asker] = row.askedBy
    ? await db
        .select({ phone: user.phoneNumber, role: user.role })
        .from(user)
        .where(eq(user.id, row.askedBy))
    : [];
  if (!asker?.phone || asker.role !== 'citizen') return { ok: true, notified: 'none', link: null };
  const l = await listingInfo(listingId);
  try {
    const n = await notify.sendWa(
      'question_answered',
      { phone: asker.phone, role: 'citizen' },
      {
        listing: l?.name ?? '',
        question: row.question,
        answer: p.data.answer,
        link: appUrl(paths.listing(l?.slug ?? ''))
      }
    );
    if (n.status === 'sent') return { ok: true, notified: 'sent', link: null };
    return { ok: true, notified: 'link', link: viewer === 'admin' ? n.link : null };
  } catch (e) {
    console.error('[mitra] gagal mengirim question_answered', e);
    return { ok: true, notified: 'none', link: null };
  }
}

// ───────────────────────────── Beranda, ulasan, statistik ─────────────────────────────

const num = (v: unknown) => Number(v ?? 0);

/** Ringkasan sejak `since`: dipesan, diterima, selesai, pelanggan baru (pesanan pertama di usaha ini). */
export async function monthSummary(listingId: number, since: Date): Promise<MonthSummary> {
  const t = since.toISOString();
  const res = await db.execute(sql`
    select
      (select count(*) from bookings where listing_id = ${listingId} and created_at >= ${t}) as booked,
      (select count(*) from booking_events e join bookings b on b.id = e.booking_id
        where b.listing_id = ${listingId} and e.to_status = 'accepted' and e.created_at >= ${t}) as accepted,
      (select count(*) from booking_events e join bookings b on b.id = e.booking_id
        where b.listing_id = ${listingId} and e.to_status = 'completed' and e.created_at >= ${t}) as completed,
      (select count(*) from (
        select citizen_id from bookings where listing_id = ${listingId} and citizen_id is not null
        group by citizen_id having min(created_at) >= ${t}) x) as new_customers
  `);
  const r = res.rows[0] as Record<string, unknown>;
  return {
    booked: num(r.booked),
    accepted: num(r.accepted),
    completed: num(r.completed),
    newCustomers: num(r.new_customers)
  };
}

export async function unitCount(listingId: number) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(units)
    .where(and(eq(units.listingId, listingId), eq(units.isActive, true)));
  return r.n;
}

/** Ulasan dari pesanan selesai, tanpa identitas warga. */
export async function reviewsFor(listingId: number): Promise<ReviewsData> {
  const rows = await db
    .select({
      id: reviews.id,
      satisfied: reviews.satisfied,
      stars: reviews.stars,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      details: bookings.details,
      unitName: units.name,
      categoryName: categories.name
    })
    .from(reviews)
    .innerJoin(bookings, eq(bookings.id, reviews.bookingId))
    .innerJoin(categories, eq(categories.id, bookings.categoryId))
    .leftJoin(units, eq(units.id, bookings.unitId))
    .where(eq(reviews.listingId, listingId))
    .orderBy(sql`${reviews.createdAt} desc`)
    .limit(100);
  const starred = rows.filter((r) => r.stars !== null);
  return {
    items: rows.map((r) => ({
      id: r.id,
      satisfied: r.satisfied,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      item: bookingItem({
        unit: r.unitName ? { id: 0, name: r.unitName } : null,
        category: { id: 0, name: r.categoryName, doorSlug: null, scheduleKind: 'none' },
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        details: r.details
      })
    })),
    total: rows.length,
    satisfied: rows.filter((r) => r.satisfied).length,
    avgStars: starred.length
      ? Math.round((starred.reduce((n, r) => n + r.stars!, 0) / starred.length) * 10) / 10
      : null
  };
}

/** Statistik sederhana `days` hari terakhir (WIB). */
export async function stats(listingId: number, days = 30): Promise<StatsData> {
  const firstDay = addDays(jakartaDate(new Date()), -(days - 1));
  const since = fromJakarta(firstDay, '00:00').toISOString();
  const res = await db.execute(sql`
    select
      (select coalesce(sum(views), 0) from listing_daily_stats
        where listing_id = ${listingId} and day >= ${firstDay}) as views,
      (select count(*) from bookings where listing_id = ${listingId} and created_at >= ${since}) as booked,
      (select count(*) from bookings where listing_id = ${listingId} and created_at >= ${since}
        and status <> 'sent') as answered,
      (select count(*) from bookings b where b.listing_id = ${listingId} and b.created_at >= ${since}
        and exists (select 1 from booking_events e where e.booking_id = b.id and e.to_status = 'accepted')) as accepted
  `);
  const r = res.rows[0] as Record<string, unknown>;
  // Jam paling ramai: jam mulai pesanan (permintaan tanpa jadwal: jam dibuat), WIB, 90 hari terakhir.
  const hours = await db.execute(sql`
    select extract(hour from coalesce(starts_at, created_at) at time zone 'Asia/Jakarta')::int as hour,
           count(*)::int as count
    from bookings
    where listing_id = ${listingId}
      and status in ('accepted', 'in_progress', 'completed')
      and created_at >= ${new Date(Date.now() - 90 * DAY).toISOString()}
    group by 1 order by 2 desc, 1 limit 5
  `);
  return {
    days,
    views: num(r.views),
    booked: num(r.booked),
    answered: num(r.answered),
    accepted: num(r.accepted),
    peakHours: (hours.rows as { hour: number; count: number }[]).map((h) => ({
      hour: num(h.hour),
      count: num(h.count)
    }))
  };
}
