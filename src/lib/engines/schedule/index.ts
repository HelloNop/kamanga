// Mesin Jadwal (PRD 8.4). Kontrak: ../contracts.ts
// Pakai binding dari ../contracts (schedule, booking, ...) hanya di dalam fungsi, bukan di tingkat atas modul.
//
// Slot dihitung di TypeScript dari beberapa query sekaligus (aturan, pengecualian, blokir, pesanan aktif),
// bukan satu query per slot. Aturan yang dipakai (keputusan lead):
// - Interval mingguan dibaca jam dinding WIB. end_time <= start_time = lewat tengah malam dan milik hari
//   ia DIMULAI (aturan hari itu dan pengecualian tanggal itu yang berlaku, termasuk untuk slot 00:00).
// - Jadwal `slot`: slot berdurasi slot_minutes, slot berikutnya mulai setelah slot_minutes + gap_minutes,
//   harus muat utuh di interval. Pesanan boleh beberapa slot berurutan dalam SATU interval.
// - Jadwal `seat` (travel): satu baris aturan = satu keberangkatan pada start_time selama slot_minutes.
//   Keberangkatan dikenali dari jam berangkatnya; blokir mengenai keberangkatan bila jam berangkatnya
//   ada di dalam rentang blokir.
import { and, between, eq, gt, inArray, isNotNull, isNull, lt, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  categories,
  listingCategories,
  scheduleExceptions,
  scheduleRules,
  slotBlocks,
  units
} from '@/db/schema';
import {
  ACTIVE_BOOKING_STATUSES,
  type BlockResult,
  type HoldFailReason,
  type HoldResult,
  type ScheduleEngine,
  type ScheduleKind,
  type Slot,
  type SlotState,
  type Tx
} from '../contracts';
import { addDays, fromJakarta, jakartaDate, jakartaTime } from '../time';

const MIN = 60_000;
const DAY = 86_400_000;

type Conn = Pick<Tx, 'select'>;
type Unit = Awaited<ReturnType<typeof loadUnits>>[number];
type Rule = typeof scheduleRules.$inferSelect;
type Data = Awaited<ReturnType<typeof load>>;
/** Slot atau keberangkatan hasil aturan, sebelum dicek blokir dan pesanan. iv = interval asalnya. */
type Gen = {
  startsAt: Date;
  endsAt: Date;
  price: number | null;
  isPeak: boolean;
  minMinutes: number;
  iv: [number, number];
};

const timed = (k: ScheduleKind | null) => k === 'slot' || k === 'seat';
const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && bS < aE;
/** Blokir [bS, bE) mengenai slot/pesanan [s, e)? Seat: hanya bila jam berangkatnya di dalam blokir. */
const hits = (kind: ScheduleKind | null, bS: number, bE: number, s: number, e: number) =>
  kind === 'seat' ? bS <= s && s < bE : overlaps(bS, bE, s, e);

/** Unit + jenis jadwal dari kategori UTAMA listing pemiliknya. lock = kunci baris unit (anti-bentrok). */
function loadUnits(conn: Conn, where: SQL | undefined, lock = false) {
  const q = conn
    .select({
      id: units.id,
      listingId: units.listingId,
      capacity: units.capacity,
      isActive: units.isActive,
      kind: categories.scheduleKind
    })
    .from(units)
    .leftJoin(
      listingCategories,
      and(eq(listingCategories.listingId, units.listingId), eq(listingCategories.isPrimary, true))
    )
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .where(where);
  return lock ? q.for('update', { of: units }) : q;
}

/** Pesanan aktif ber-unit (menahan slot / kursi). */
async function loadBookings(conn: Conn, where: SQL | undefined) {
  const rows = await conn
    .select({
      id: bookings.id,
      code: bookings.code,
      unitId: bookings.unitId,
      status: bookings.status,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      seats: bookings.seats
    })
    .from(bookings)
    .where(
      and(inArray(bookings.status, [...ACTIVE_BOOKING_STATUSES]), isNotNull(bookings.unitId), where)
    );
  // unit_id terisi → starts_at/ends_at terisi (constraint bookings_unit_has_time).
  return rows.map((b) => ({ ...b, unitId: b.unitId!, startsAt: b.startsAt!, endsAt: b.endsAt! }));
}

/** Semua data jadwal unit-unit ini untuk rentang [from, to): aturan, pengecualian, blokir, pesanan aktif. */
async function load(conn: Conn, list: Unit[], from: Date, to: Date) {
  const ids = list.map((u) => u.id);
  if (!ids.length) return { rules: [], exceptions: [], blocks: [], bookings: [] };
  const listingIds = [...new Set(list.map((u) => u.listingId))];
  // Berurutan, bukan Promise.all: koneksi transaksi pg tidak boleh menjalankan query bersamaan.
  const rules = await conn.select().from(scheduleRules).where(inArray(scheduleRules.unitId, ids));
  const exceptions = await conn
    .select()
    .from(scheduleExceptions)
    .where(
      and(
        inArray(scheduleExceptions.listingId, listingIds),
        or(isNull(scheduleExceptions.unitId), inArray(scheduleExceptions.unitId, ids)),
        between(scheduleExceptions.date, addDays(jakartaDate(from), -1), jakartaDate(to))
      )
    );
  const blocks = await conn
    .select()
    .from(slotBlocks)
    .where(
      and(inArray(slotBlocks.unitId, ids), lt(slotBlocks.startsAt, to), gt(slotBlocks.endsAt, from))
    );
  const active = await loadBookings(
    conn,
    and(inArray(bookings.unitId, ids), lt(bookings.startsAt, to), gt(bookings.endsAt, from))
  );
  return { rules, exceptions, blocks, bookings: active };
}

/** Rentang jam dinding WIB pada tanggal d; jam akhir <= jam mulai berarti besoknya. */
const span = (d: string, start: string, end: string) =>
  [
    fromJakarta(d, start).getTime(),
    fromJakarta(end <= start ? addDays(d, 1) : d, end).getTime()
  ] as const;

/** Harga satu slot; jam ramai bila jam mulainya di [peak_start, peak_end) (boleh lewat tengah malam). */
function priceAt(r: Rule, at: number) {
  const t = jakartaTime(new Date(at));
  const ps = r.peakStart?.slice(0, 5);
  const pe = r.peakEnd?.slice(0, 5);
  const isPeak =
    r.peakPrice != null && !!ps && !!pe && (ps < pe ? t >= ps && t < pe : t >= ps || t < pe);
  return { price: isPeak ? r.peakPrice : r.price, isPeak };
}

/** Slot/keberangkatan satu unit untuk interval yang DIMULAI pada tanggal WIB di sekitar [from, to). */
function generate(u: Unit, data: Data, from: Date, to: Date): Gen[] {
  if (!u.isActive || !timed(u.kind)) return [];
  const rules = data.rules.filter((r) => r.unitId === u.id);
  const out: Gen[] = [];
  // Mulai sehari sebelumnya: interval lewat tengah malam dari kemarin bisa masuk ke rentang.
  for (let d = addDays(jakartaDate(from), -1); d <= jakartaDate(to); d = addDays(d, 1)) {
    const onDay = (e: { date: string; listingId: number }) =>
      e.date === d && e.listingId === u.listingId;
    // Pengecualian khusus unit mengalahkan pengecualian untuk semua unit.
    const ex =
      data.exceptions.find((e) => onDay(e) && e.unitId === u.id) ??
      data.exceptions.find((e) => onDay(e) && e.unitId === null);
    if (ex?.isClosed) continue;
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    const dayRules = rules.filter((r) => r.weekday === weekday);

    if (u.kind === 'seat') {
      // Jam khusus untuk travel: hanya keberangkatan yang jam berangkatnya di dalam jam khusus.
      const win = ex && span(d, ex.startTime!, ex.endTime!);
      for (const r of dayRules) {
        const s = fromJakarta(d, r.startTime).getTime();
        if (win && (s < win[0] || s >= win[1])) continue;
        const e = s + r.slotMinutes * MIN;
        out.push({
          startsAt: new Date(s),
          endsAt: new Date(e),
          ...priceAt(r, s),
          minMinutes: 0,
          iv: [s, e]
        });
      }
      continue;
    }

    // Jam khusus menggantikan interval mingguan; ukuran slot, jeda, dan harga dari aturan unit.
    const base = dayRules[0] ?? rules[0];
    const intervals = ex
      ? base
        ? [{ ...base, startTime: ex.startTime!, endTime: ex.endTime! }]
        : []
      : dayRules;
    for (const r of intervals) {
      const iv = span(d, r.startTime, r.endTime);
      const len = r.slotMinutes * MIN;
      for (let s = iv[0]; s + len <= iv[1]; s += len + r.gapMinutes * MIN) {
        out.push({
          startsAt: new Date(s),
          endsAt: new Date(s + len),
          ...priceAt(r, s),
          minMinutes: r.minMinutes ?? r.slotMinutes,
          iv: [iv[0], iv[1]]
        });
      }
    }
  }
  return out;
}

/** Status slot dari blokir dan pesanan aktif. need = kursi yang diminta (seat). */
function withState(u: Unit, g: Gen, data: Data, need: number): Slot {
  const s = g.startsAt.getTime();
  const e = g.endsAt.getTime();
  const blocked = data.blocks.some(
    (b) => b.unitId === u.id && hits(u.kind, b.startsAt.getTime(), b.endsAt.getTime(), s, e)
  );
  const base = {
    unitId: u.id,
    startsAt: g.startsAt,
    endsAt: g.endsAt,
    price: g.price,
    isPeak: g.isPeak
  };

  if (u.kind === 'seat') {
    const taken = data.bookings.filter((b) => b.unitId === u.id && b.startsAt.getTime() === s);
    const left = Math.max(0, u.capacity - taken.reduce((n, b) => n + b.seats, 0));
    const state: SlotState = blocked
      ? 'blocked'
      : left >= need
        ? 'free'
        : taken.some((b) => b.status !== 'sent')
          ? 'booked'
          : 'held';
    return { ...base, state, capacity: u.capacity, seatsLeft: blocked ? 0 : left };
  }

  const over = data.bookings.filter(
    (b) => b.unitId === u.id && overlaps(b.startsAt.getTime(), b.endsAt.getTime(), s, e)
  );
  const state: SlotState = blocked
    ? 'blocked'
    : over.some((b) => b.status !== 'sent')
      ? 'booked'
      : over.length
        ? 'held'
        : 'free';
  return { ...base, state, capacity: 1, seatsLeft: state === 'free' ? 1 : 0 };
}

const fail = (reason: HoldFailReason): HoldResult => ({ ok: false, reason });

export const scheduleEngine: ScheduleEngine = {
  async getAvailability(q) {
    if (!q.unitIds.length || !(q.from < q.to)) return [];
    const list = await loadUnits(db, inArray(units.id, q.unitIds));
    // ponytail: blokir/pesanan dimuat sampai to + 1 hari, cukup selama slot/perjalanan <= 24 jam.
    const data = await load(db, list, q.from, new Date(q.to.getTime() + DAY));
    const now = Date.now();
    const need = q.seats ?? 1;
    const out: Slot[] = [];
    for (const u of list) {
      for (const g of generate(u, data, q.from, q.to)) {
        if (g.startsAt < q.from || g.startsAt >= q.to) continue;
        const slot = withState(u, g, data, need);
        if (q.includeTaken || (slot.state === 'free' && g.startsAt.getTime() >= now))
          out.push(slot);
      }
    }
    return out.toSorted(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.unitId - b.unitId
    );
  },

  async holdSlot(tx, req) {
    // Kunci baris unit dulu: holdSlot dan blockSlot untuk unit yang sama berjalan bergiliran.
    const [u] = await loadUnits(tx, eq(units.id, req.unitId), true);
    if (!u?.isActive) return fail('unit_inactive');
    if (!timed(u.kind)) return fail('closed');
    const s = req.startsAt.getTime();
    const e = req.endsAt.getTime();
    if (!(s < e)) return fail('misaligned');
    if (s < Date.now()) return fail('past');

    const data = await load(tx, [u], req.startsAt, req.endsAt);
    const gens = generate(u, data, req.startsAt, req.endsAt);

    if (u.kind === 'seat') {
      const seats = req.seats ?? 1;
      if (!Number.isInteger(seats) || seats < 1) return fail('no_seats');
      const dep = gens.find((g) => g.startsAt.getTime() === s && g.endsAt.getTime() === e);
      if (!dep)
        return fail(gens.some((g) => overlaps(g.iv[0], g.iv[1], s, e)) ? 'misaligned' : 'closed');
      if (data.blocks.some((b) => hits('seat', b.startsAt.getTime(), b.endsAt.getTime(), s, e)))
        return fail('blocked');
      const used = data.bookings
        .filter((b) => b.startsAt.getTime() === s)
        .reduce((n, b) => n + b.seats, 0);
      if (u.capacity - used < seats) return fail('no_seats');
      return { ok: true, price: dep.price == null ? null : dep.price * seats, exclusive: false };
    }

    // Harus di dalam satu interval buka, awal = awal suatu slot, akhir = akhir suatu slot.
    const inside = gens.find((g) => g.iv[0] <= s && e <= g.iv[1]);
    if (!inside) return fail('closed');
    const covered = gens.filter(
      (g) => g.iv[0] === inside.iv[0] && g.startsAt.getTime() >= s && g.endsAt.getTime() <= e
    );
    if (covered[0]?.startsAt.getTime() !== s || covered.at(-1)?.endsAt.getTime() !== e)
      return fail('misaligned');
    if (e - s < inside.minMinutes * MIN) return fail('too_short');
    // Cek seluruh rentang (termasuk jeda antarslot yang ikut terpakai).
    if (data.blocks.some((b) => overlaps(b.startsAt.getTime(), b.endsAt.getTime(), s, e)))
      return fail('blocked');
    if (data.bookings.some((b) => overlaps(b.startsAt.getTime(), b.endsAt.getTime(), s, e)))
      return fail('taken');
    const price = covered.every((g) => g.price != null)
      ? covered.reduce((n, g) => n + g.price!, 0)
      : null;
    return { ok: true, price, exclusive: true };
  },

  async blockSlot(input) {
    const s = input.startsAt.getTime();
    const e = input.endsAt.getTime();
    if (!(s < e)) return { ok: false, reason: 'invalid' };
    return db.transaction(async (tx): Promise<BlockResult> => {
      const [u] = await loadUnits(tx, eq(units.id, input.unitId), true);
      if (!u) return { ok: false, reason: 'invalid' };
      const data = await load(tx, [u], input.startsAt, input.endsAt);
      if (data.blocks.length) return { ok: false, reason: 'invalid' }; // beririsan blokir lain
      const clash = data.bookings.filter((b) =>
        hits(u.kind, s, e, b.startsAt.getTime(), b.endsAt.getTime())
      );
      if (clash.length)
        return { ok: false, reason: 'conflict', bookingIds: clash.map((b) => b.id) };
      const [row] = await tx
        .insert(slotBlocks)
        .values({
          unitId: u.id,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          reason: input.reason,
          note: input.note ?? null,
          createdBy: input.actor.userId ?? null
        })
        .returning({ id: slotBlocks.id });
      return { ok: true, id: row.id };
    });
  },

  async unblockSlot(blockId) {
    await db.delete(slotBlocks).where(eq(slotBlocks.id, blockId));
  },

  async findConflicts(listingId) {
    // Hanya pesanan yang belum lewat; pesanan tidak pernah dihapus karena jam buka berubah (PRD 8.4).
    const active = await loadBookings(
      db,
      and(eq(bookings.listingId, listingId), gt(bookings.endsAt, new Date()))
    );
    if (!active.length) return [];
    const list = await loadUnits(db, eq(units.listingId, listingId));
    const from = new Date(Math.min(...active.map((b) => b.startsAt.getTime())));
    const to = new Date(Math.max(...active.map((b) => b.endsAt.getTime())));
    const data = await load(db, list, from, to);
    const gensBy = new Map(list.map((u) => [u.id, { u, gens: generate(u, data, from, to) }]));

    return active.flatMap((b) => {
      const s = b.startsAt.getTime();
      const e = b.endsAt.getTime();
      const entry = gensBy.get(b.unitId);
      const kind = entry?.u.kind ?? null;
      const gens = entry?.gens ?? [];
      // Seat: keberangkatannya masih ada; slot: rentangnya masih di dalam satu interval buka.
      const open =
        kind === 'seat'
          ? gens.some((g) => g.startsAt.getTime() === s)
          : gens.some((g) => g.iv[0] <= s && e <= g.iv[1]);
      const blocked = data.blocks.some(
        (x) => x.unitId === b.unitId && hits(kind, x.startsAt.getTime(), x.endsAt.getTime(), s, e)
      );
      if (open && !blocked) return [];
      const problem = open ? ('blocked' as const) : ('closed' as const);
      return [
        {
          bookingId: b.id,
          code: b.code,
          unitId: b.unitId,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          problem
        }
      ];
    });
  }
};
