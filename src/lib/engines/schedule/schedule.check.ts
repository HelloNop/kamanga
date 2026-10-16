// Pemeriksaan Mesin Jadwal terhadap DATABASE SUNGGUHAN (kamanga_v2).
// Prasyarat: data acuan (kategori padel-court dan intercity-travel): bun run db:seed-reference.
// Membuat listing uji `test-jadwal-…` sendiri dan menghapusnya di akhir; data lain tidak disentuh.
// Jalankan: bun run src/lib/engines/schedule/schedule.check.ts
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { and, eq, inArray, like } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  categories,
  listingCategories,
  listings,
  scheduleExceptions,
  scheduleRules,
  slotBlocks,
  units
} from '@/db/schema';
import { schedule, type Slot, type SlotRequest, type Tx } from '../contracts';
import { addDays, fromJakarta, jakartaDate, jakartaTime, jakartaWeekday } from '../time';

const at = fromJakarta;
const label = (s: Slot) => `${jakartaDate(s.startsAt)} ${jakartaTime(s.startsAt)}`;
const hold = (req: SlotRequest) => db.transaction((tx) => schedule.holdSlot(tx, req));
const reasonOf = async (req: SlotRequest) => {
  const r = await hold(req);
  return r.ok ? 'ok' : r.reason;
};
const pgCode = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err.code ?? err.cause?.code;
};

async function cleanup() {
  const ids = (
    await db.select({ id: listings.id }).from(listings).where(like(listings.slug, 'test-jadwal-%'))
  ).map((l) => l.id);
  if (!ids.length) return;
  // bookings.unit_id tanpa cascade: hapus pesanan uji lebih dulu, sisanya ikut terhapus bersama listing.
  await db.delete(bookings).where(inArray(bookings.listingId, ids));
  await db.delete(listings).where(inArray(listings.id, ids));
}

const today = jakartaDate(new Date());
const D = addDays(today, 8); // hari uji (masa depan)
const D1 = addDays(D, 1);
const D2 = addDays(D, 2);
const wd = jakartaWeekday(at(D, '12:00'));
const actor = { kind: 'provider' as const };

const cat = async (slug: string) =>
  (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)))[0]?.id;
const makeListing = async (slug: string, categoryId: number) => {
  const [l] = await db
    .insert(listings)
    .values({ slug, name: '[UJI] Jadwal', kind: 'provider', status: 'published' })
    .returning({ id: listings.id });
  await db.insert(listingCategories).values({ listingId: l.id, categoryId, isPrimary: true });
  return l.id;
};
const unit = async (listingId: number, name: string, capacity = 1, isActive = true) =>
  (
    await db
      .insert(units)
      .values({ listingId, name, capacity, isActive })
      .returning({ id: units.id })
  )[0].id;
const avail = (
  unitId: number,
  from: Date,
  to: Date,
  extra: { seats?: number; includeTaken?: boolean } = {}
) => schedule.getAvailability({ unitIds: [unitId], from, to, ...extra });
const dropEx = (id: number) => db.delete(scheduleExceptions).where(eq(scheduleExceptions.id, id));

await cleanup();
try {
  const padelCat = await cat('padel-court');
  const travelCat = await cat('intercity-travel');
  assert.ok(padelCat && travelCat, 'Butuh data acuan: bun run db:seed-reference');

  const P = await makeListing(`test-jadwal-padel-${process.pid}`, padelCat);
  const T = await makeListing(`test-jadwal-travel-${process.pid}`, travelCat);
  const A = await unit(P, 'Lapangan A');
  const B = await unit(P, 'Kursi B');
  const C = await unit(P, 'Lapangan C (nonaktif)', 1, false);
  const R = await unit(T, 'Padang → Bukittinggi', 3);

  const padel = { slotMinutes: 60, minMinutes: 120, price: 100_000, peakPrice: 150_000 };
  const peak = { peakStart: '20:00', peakEnd: '00:00' }; // jam ramai lewat tengah malam
  const [ruleA1] = await db
    .insert(scheduleRules)
    .values([
      { unitId: A, weekday: wd, startTime: '08:00', endTime: '12:00', ...padel, ...peak },
      { unitId: A, weekday: wd, startTime: '13:00', endTime: '17:00', ...padel, ...peak },
      { unitId: A, weekday: wd, startTime: '20:00', endTime: '02:00', ...padel, ...peak },
      // barber: 30 menit + jeda 10 menit; hari ini buka 24 jam (end = start)
      {
        unitId: B,
        weekday: wd,
        startTime: '09:00',
        endTime: '11:00',
        slotMinutes: 30,
        gapMinutes: 10,
        price: 50_000
      },
      {
        unitId: B,
        weekday: jakartaWeekday(new Date()),
        startTime: '00:00',
        endTime: '00:00',
        slotMinutes: 30,
        gapMinutes: 10,
        price: 50_000
      },
      { unitId: C, weekday: wd, startTime: '08:00', endTime: '12:00' },
      // travel: dua keberangkatan, perjalanan 3 jam (waktunya saling beririsan)
      {
        unitId: R,
        weekday: wd,
        startTime: '08:00',
        endTime: '11:00',
        slotMinutes: 180,
        price: 120_000
      },
      {
        unitId: R,
        weekday: wd,
        startTime: '10:00',
        endTime: '13:00',
        slotMinutes: 180,
        price: 120_000
      }
    ])
    .returning({ id: scheduleRules.id });

  let n = 0;
  const book = async (
    v: {
      unitId: number;
      startsAt: Date;
      endsAt: Date;
      status?: 'sent' | 'accepted' | 'rejected';
      seats?: number;
    },
    conn: Pick<Tx, 'insert'> = db
  ) => {
    const travel = v.unitId === R;
    const [b] = await conn
      .insert(bookings)
      .values({
        code: `TJ${process.pid}-${++n}`,
        listingId: travel ? T : P,
        categoryId: travel ? travelCat : padelCat,
        exclusive: !travel,
        ...v
      })
      .returning({ id: bookings.id });
    return b.id;
  };
  const dayA = () => avail(A, at(D, '00:00'), at(D1, '06:00'));

  // ───── 1. beberapa interval per hari + lewat tengah malam ─────
  const expectedA = [
    ...['08', '09', '10', '11', '13', '14', '15', '16', '20', '21', '22', '23'].map(
      (h) => `${D} ${h}:00`
    ),
    `${D1} 00:00`,
    `${D1} 01:00`
  ];
  let slots = await dayA();
  assert.deepEqual(slots.map(label), expectedA);
  assert.equal(slots.at(-1)!.endsAt.getTime(), at(D1, '02:00').getTime());
  assert.ok(slots.every((s) => s.state === 'free' && s.capacity === 1 && s.seatsLeft === 1));
  console.log('1. tiga interval sehari, 20:00–02:00 menghasilkan slot sampai 02:00 OK');

  // ───── 2. harga jam ramai ─────
  const byLabel = (list: Slot[], l: string) => list.find((s) => label(s) === l)!;
  assert.deepEqual(
    [byLabel(slots, `${D} 08:00`).price, byLabel(slots, `${D} 08:00`).isPeak],
    [100_000, false]
  );
  assert.deepEqual(
    [byLabel(slots, `${D} 20:00`).price, byLabel(slots, `${D} 20:00`).isPeak],
    [150_000, true]
  );
  assert.equal(byLabel(slots, `${D} 23:00`).isPeak, true);
  assert.deepEqual(
    [byLabel(slots, `${D1} 00:00`).price, byLabel(slots, `${D1} 00:00`).isPeak],
    [100_000, false]
  );
  console.log('2. harga jam ramai (20:00–00:00) OK');

  // ───── 3. durasi minimal, batas slot, jam tutup ─────
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '08:00'), endsAt: at(D, '09:00') }),
    'too_short'
  );
  assert.deepEqual(await hold({ unitId: A, startsAt: at(D, '08:00'), endsAt: at(D, '10:00') }), {
    ok: true,
    price: 200_000,
    exclusive: true
  });
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '08:30'), endsAt: at(D, '10:30') }),
    'misaligned'
  );
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '11:00'), endsAt: at(D, '13:00') }),
    'closed'
  );
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '06:00'), endsAt: at(D, '08:00') }),
    'closed'
  );
  // lewat tengah malam: 23:00 (ramai) + 00:00 (biasa)
  assert.deepEqual(await hold({ unitId: A, startsAt: at(D, '23:00'), endsAt: at(D1, '01:00') }), {
    ok: true,
    price: 250_000,
    exclusive: true
  });
  assert.equal(
    await reasonOf({ unitId: C, startsAt: at(D, '08:00'), endsAt: at(D, '09:00') }),
    'unit_inactive'
  );
  assert.equal((await avail(C, at(D, '00:00'), at(D1, '00:00'))).length, 0);
  const lastWeek = addDays(D, -14);
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(lastWeek, '08:00'), endsAt: at(lastWeek, '10:00') }),
    'past'
  );
  console.log('3. durasi minimal (too_short), misaligned, closed, unit nonaktif, lewat waktu OK');

  // ───── 4. jeda antarslot ─────
  slots = await avail(B, at(D, '00:00'), at(D1, '00:00'));
  assert.deepEqual(
    slots.map((s) => jakartaTime(s.startsAt)),
    ['09:00', '09:40', '10:20']
  );
  assert.deepEqual(await hold({ unitId: B, startsAt: at(D, '09:00'), endsAt: at(D, '10:10') }), {
    ok: true,
    price: 100_000,
    exclusive: true
  });
  assert.equal(
    (await hold({ unitId: B, startsAt: at(D, '09:00'), endsAt: at(D, '09:30') })).ok,
    true
  );
  assert.equal(
    await reasonOf({ unitId: B, startsAt: at(D, '09:00'), endsAt: at(D, '09:40') }),
    'misaligned'
  );
  assert.equal(
    await reasonOf({ unitId: B, startsAt: at(D, '09:30'), endsAt: at(D, '10:00') }),
    'misaligned'
  );
  console.log('4. jeda 10 menit: 09:00, 09:40, 10:20; dua slot berurutan ikut jedanya OK');

  // ───── 5. hanya slot yang belum lewat (bawaan) vs includeTaken ─────
  const now = new Date();
  const todayFree = await avail(B, at(today, '00:00'), at(addDays(today, 1), '00:00'));
  const todayAll = await avail(B, at(today, '00:00'), at(addDays(today, 1), '00:00'), {
    includeTaken: true
  });
  assert.equal(todayAll.length, 36); // 24 jam / 40 menit
  assert.ok(todayFree.every((s) => s.startsAt >= now));
  assert.ok(todayAll.some((s) => s.startsAt < now));
  console.log('5. slot lewat tidak tampil, includeTaken menampilkan semua (buka 24 jam) OK');

  // ───── 6. tidak ada slot ganda: dua permintaan BERSAMAAN ─────
  const race = () =>
    db.transaction(async (tx) => {
      const r = await schedule.holdSlot(tx, {
        unitId: A,
        startsAt: at(D, '10:00'),
        endsAt: at(D, '12:00')
      });
      if (!r.ok) return r.reason;
      await sleep(150); // beri waktu transaksi lain menabrak
      await book({ unitId: A, startsAt: at(D, '10:00'), endsAt: at(D, '12:00') }, tx);
      return 'ok';
    });
  assert.deepEqual((await Promise.all([race(), race()])).toSorted(), ['ok', 'taken']);
  // tanpa holdSlot pun database menolak (exclusion constraint bookings_no_overlap)
  await assert.rejects(
    book({ unitId: A, startsAt: at(D, '11:00'), endsAt: at(D, '12:00') }),
    (e) => pgCode(e) === '23P01'
  );
  const raced = (
    await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.unitId, A), eq(bookings.startsAt, at(D, '10:00'))))
  ).map((b) => b.id);
  assert.equal(raced.length, 1);
  console.log(
    '6. dua permintaan bersamaan: tepat satu berhasil; constraint database menolak tumpang tindih OK'
  );

  // ───── 7. status held/booked ─────
  const b8 = await book({ unitId: A, startsAt: at(D, '08:00'), endsAt: at(D, '10:00') });
  const state = async (l: string) =>
    byLabel(await avail(A, at(D, '00:00'), at(D1, '06:00'), { includeTaken: true }), l).state;
  assert.equal(await state(`${D} 08:00`), 'held');
  assert.equal(await state(`${D} 10:00`), 'held');
  await db.update(bookings).set({ status: 'accepted' }).where(eq(bookings.id, b8));
  assert.equal(await state(`${D} 09:00`), 'booked');
  assert.ok(
    !(await dayA()).some((s) => [`${D} 08:00`, `${D} 09:00`, `${D} 10:00`].includes(label(s)))
  );
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '08:00'), endsAt: at(D, '10:00') }),
    'taken'
  );
  console.log('7. pesanan sent = held, accepted = booked, tidak tampil kosong OK');

  // ───── 8. blokir manual ─────
  const blk = await schedule.blockSlot({
    unitId: A,
    startsAt: at(D, '13:00'),
    endsAt: at(D, '15:00'),
    reason: 'walk_in',
    actor
  });
  assert.ok(blk.ok);
  slots = await dayA();
  assert.ok(!slots.some((s) => [`${D} 13:00`, `${D} 14:00`].includes(label(s))));
  assert.ok(slots.some((s) => label(s) === `${D} 15:00`));
  assert.equal(await state(`${D} 14:00`), 'blocked');
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '14:00'), endsAt: at(D, '16:00') }),
    'blocked'
  );
  assert.equal(
    (await hold({ unitId: A, startsAt: at(D, '15:00'), endsAt: at(D, '17:00') })).ok,
    true
  );
  assert.deepEqual(
    await schedule.blockSlot({
      unitId: A,
      startsAt: at(D, '14:00'),
      endsAt: at(D, '16:00'),
      reason: 'other',
      actor
    }),
    { ok: false, reason: 'invalid' }
  );
  assert.deepEqual(
    await schedule.blockSlot({
      unitId: A,
      startsAt: at(D, '16:00'),
      endsAt: at(D, '16:00'),
      reason: 'other',
      actor
    }),
    { ok: false, reason: 'invalid' }
  );
  const clash = await schedule.blockSlot({
    unitId: A,
    startsAt: at(D, '09:00'),
    endsAt: at(D, '11:00'),
    reason: 'whatsapp',
    actor
  });
  assert.ok(!clash.ok && clash.reason === 'conflict');
  assert.deepEqual(clash.bookingIds?.toSorted(), [b8, raced[0]].toSorted());
  await schedule.unblockSlot(blk.id, actor);
  assert.equal(await state(`${D} 14:00`), 'free');
  console.log(
    '8. blokir: tidak tampil kosong, tidak bisa ditahan, tumpuk blokir invalid, di atas pesanan conflict OK'
  );

  // ───── 9. pengecualian tanggal ─────
  const except = (v: Partial<typeof scheduleExceptions.$inferInsert> & { date: string }) =>
    db
      .insert(scheduleExceptions)
      .values({ listingId: P, ...v })
      .returning({ id: scheduleExceptions.id })
      .then((r) => r[0].id);
  let ex = await except({ date: D }); // tutup sehari, semua unit
  assert.equal((await dayA()).length, 0); // termasuk slot 00:00 dan 01:00 milik hari D
  assert.equal((await avail(B, at(D, '00:00'), at(D1, '00:00'))).length, 0);
  assert.equal(
    await reasonOf({ unitId: A, startsAt: at(D, '20:00'), endsAt: at(D, '22:00') }),
    'closed'
  );
  await dropEx(ex);
  ex = await except({ date: D1 }); // tutup besoknya: slot 00:00 tetap milik hari D
  assert.deepEqual((await dayA()).filter((s) => jakartaDate(s.startsAt) === D1).map(label), [
    `${D1} 00:00`,
    `${D1} 01:00`
  ]);
  await dropEx(ex);
  ex = await except({ date: D, unitId: B, isClosed: false, startTime: '15:00', endTime: '16:00' });
  slots = await avail(B, at(D, '00:00'), at(D1, '00:00'));
  assert.deepEqual(
    slots.map((s) => [jakartaTime(s.startsAt), s.price]),
    [['15:00', 50_000]]
  );
  assert.equal((await dayA()).length > 0, true); // pengecualian unit B tidak mengenai A
  await dropEx(ex);
  ex = await except({ date: D2, unitId: A, isClosed: false, startTime: '10:00', endTime: '12:00' });
  assert.deepEqual(
    (await avail(A, at(D2, '00:00'), at(addDays(D2, 1), '00:00'))).map((s) =>
      jakartaTime(s.startsAt)
    ),
    ['10:00', '11:00']
  ); // hari tanpa aturan mingguan: ukuran slot dari aturan unit lain hari
  await dropEx(ex);
  console.log(
    '9. pengecualian: tutup sehari, slot lewat tengah malam ikut hari mulai, jam khusus per unit OK'
  );

  // ───── 10. konflik setelah jam buka berubah ─────
  assert.deepEqual(await schedule.findConflicts(P), []);
  ex = await except({ date: D });
  const closed = await schedule.findConflicts(P);
  assert.deepEqual(
    closed.map((c) => [c.bookingId, c.problem]).toSorted(),
    [
      [b8, 'closed'],
      [raced[0], 'closed']
    ].toSorted()
  );
  await dropEx(ex);
  await db.update(scheduleRules).set({ startTime: '09:00' }).where(eq(scheduleRules.id, ruleA1.id));
  assert.deepEqual(
    (await schedule.findConflicts(P)).map((c) => [c.bookingId, c.problem]),
    [[b8, 'closed']]
  );
  assert.equal((await db.select().from(bookings).where(eq(bookings.id, b8))).length, 1); // pesanan tidak dihapus
  await db.update(scheduleRules).set({ startTime: '08:00' }).where(eq(scheduleRules.id, ruleA1.id));
  const bB = await book({
    unitId: B,
    startsAt: at(D, '09:00'),
    endsAt: at(D, '09:30'),
    status: 'accepted'
  });
  await db
    .insert(slotBlocks)
    .values({ unitId: B, startsAt: at(D, '09:00'), endsAt: at(D, '09:30') });
  assert.deepEqual(
    (await schedule.findConflicts(P)).map((c) => [c.bookingId, c.problem]),
    [[bB, 'blocked']]
  );
  console.log(
    '10. findConflicts: libur dan jam buka berubah = closed, blokir = blocked, pesanan tetap ada OK'
  );

  // ───── 11. kursi travel ─────
  const dep8 = { unitId: R, startsAt: at(D, '08:00'), endsAt: at(D, '11:00') };
  const seatsAt = async (seats = 1, includeTaken = false) =>
    (await avail(R, at(D, '00:00'), at(D1, '00:00'), { seats, includeTaken })).map(
      (s) => `${jakartaTime(s.startsAt)} ${s.state} ${s.seatsLeft}`
    );
  assert.deepEqual(await seatsAt(), ['08:00 free 3', '10:00 free 3']);
  assert.deepEqual(await hold({ ...dep8, seats: 2 }), {
    ok: true,
    price: 240_000,
    exclusive: false
  });
  const t1 = await book({ ...dep8, seats: 2 }); // ditahan (sent)
  assert.deepEqual(await seatsAt(), ['08:00 free 1', '10:00 free 3']);
  assert.deepEqual(await seatsAt(2), ['10:00 free 3']);
  assert.deepEqual(await seatsAt(2, true), ['08:00 held 1', '10:00 free 3']);
  assert.equal(await reasonOf({ ...dep8, seats: 2 }), 'no_seats');
  // dua permintaan bersamaan untuk kursi terakhir: tepat satu berhasil (kunci baris unit)
  const seatRace = () =>
    db.transaction(async (tx) => {
      const r = await schedule.holdSlot(tx, { ...dep8, seats: 1 });
      if (!r.ok) return r.reason;
      await sleep(150);
      await book({ ...dep8, seats: 1, status: 'accepted' }, tx);
      return 'ok';
    });
  assert.deepEqual((await Promise.all([seatRace(), seatRace()])).toSorted(), ['no_seats', 'ok']);
  assert.deepEqual(await seatsAt(1, true), ['08:00 booked 0', '10:00 free 3']);
  await db.update(bookings).set({ status: 'rejected' }).where(eq(bookings.id, t1)); // ditolak → kursi kembali
  assert.deepEqual(await seatsAt(), ['08:00 free 2', '10:00 free 3']);
  assert.equal((await hold({ ...dep8, seats: 2 })).ok, true);
  assert.equal(
    await reasonOf({ unitId: R, startsAt: at(D, '08:00'), endsAt: at(D, '10:00') }),
    'misaligned'
  );
  assert.equal(
    await reasonOf({ unitId: R, startsAt: at(D, '15:00'), endsAt: at(D, '18:00') }),
    'closed'
  );
  // blokir keberangkatan: hanya yang jam berangkatnya di dalam blokir
  assert.equal(
    (
      await schedule.blockSlot({
        unitId: R,
        startsAt: at(D, '08:00'),
        endsAt: at(D, '08:01'),
        reason: 'whatsapp',
        actor
      })
    ).ok,
    false
  ); // ada pesanan diterima di keberangkatan 08:00 → conflict
  assert.ok(
    (
      await schedule.blockSlot({
        unitId: R,
        startsAt: at(D, '10:00'),
        endsAt: at(D, '10:01'),
        reason: 'whatsapp',
        actor
      })
    ).ok
  );
  assert.deepEqual(await seatsAt(1, true), ['08:00 free 2', '10:00 blocked 0']);
  assert.equal(
    await reasonOf({ unitId: R, startsAt: at(D, '10:00'), endsAt: at(D, '13:00') }),
    'blocked'
  );
  console.log(
    '11. kursi travel: berkurang saat ditahan/diterima, no_seats saat penuh, kembali saat ditolak OK'
  );
} finally {
  await cleanup();
}
const left = await db
  .select({ id: listings.id })
  .from(listings)
  .where(like(listings.slug, 'test-jadwal-%'));
assert.equal(left.length, 0);
console.log('Semua pemeriksaan Mesin Jadwal lulus; data uji dihapus.');
process.exit(0);
