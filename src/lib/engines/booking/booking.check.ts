// Pemeriksaan Mesin Pesanan terhadap DATABASE SUNGGUHAN (kamanga_v2). Prasyarat: data acuan (db:seed-reference).
// Membuat data uji sendiri (listing slug test-pesanan-…, akun …@test.invalid) dan menghapusnya di akhir.
// WA tidak dikirim: notify.sendWa diganti tiruan yang mencatat panggilan.
// Jalankan: bun run src/lib/engines/booking/booking.check.ts   (script: check:booking)
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookingContacts,
  bookingEvents,
  bookings,
  categories,
  listingCategories,
  listings,
  locations,
  scheduleRules,
  units,
  user
} from '@/db/schema';
import {
  type CreateBookingInput,
  type ProviderBookingView,
  booking,
  notify,
  schedule,
  type WaTemplate
} from '@/lib/engines/contracts';
import { getSetting } from '@/lib/settings';
import { addDays, fromJakarta, jakartaDate } from '../time';

// ───── tiruan WA ─────
type Sent = {
  template: WaTemplate;
  phone: string;
  role: string;
  params: Record<string, unknown>;
  bookingId?: number;
};
const sent: Sent[] = [];
notify.sendWa = (async (template, to, params, opts) => {
  sent.push({ template, phone: to.phone, role: to.role, params, bookingId: opts?.bookingId });
  return {
    mode: 'fallback',
    status: 'link',
    messageId: sent.length,
    link: `https://wa.me/${to.phone}`,
    text: template
  };
}) as typeof notify.sendWa;
const sentFor = (id: number, template?: WaTemplate) =>
  sent.filter((s) => s.bookingId === id && (!template || s.template === template));

// ───── holdSlot: pakai yang asli bila sudah diisi agent-jadwal ─────
let realHold = true;
try {
  await db.transaction((tx) =>
    schedule.holdSlot(tx, {
      unitId: -1,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 3.6e6)
    })
  );
} catch (e) {
  realHold = !String(e).includes('belum diisi');
}
if (!realHold) {
  console.log(
    'CATATAN: schedule.holdSlot masih stub → memakai tiruan (kunci unit, ok). Uji ulang dengan mesin asli.'
  );
  schedule.holdSlot = async (tx, req) => {
    await tx.execute(sql`select id from units where id = ${req.unitId} for update`);
    return { ok: true, price: 150_000, exclusive: true };
  };
}

// ───── data uji ─────
const tag = `test-pesanan-${Date.now().toString(36)}`;
const [citizen, citizen2, owner, owner2] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const contact = {
  name: 'Warga Uji',
  phone: '6289900011122',
  address: 'Jl. Uji Privasi No. 7',
  point: { lat: -0.91, lng: 100.4 },
  note: 'pagar hijau'
};
const providerWa = '6281200000001';

const catId = async (slug: string) =>
  (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)))[0].id;
const padel = await catId('padel-court');
const ac = await catId('ac-repair');
const [kuranji] = await db
  .select({ id: locations.id })
  .from(locations)
  .where(and(eq(locations.name, 'Kuranji'), eq(locations.level, 'district')));
assert.ok(kuranji, 'butuh data acuan lokasi (Kuranji)');

async function mkListing(
  suffix: string,
  categoryId: number,
  extra: Partial<typeof listings.$inferInsert> = {}
) {
  const [l] = await db
    .insert(listings)
    .values({
      slug: `${tag}-${suffix}`,
      name: `[UJI] Pesanan ${suffix}`,
      kind: 'provider',
      status: 'published',
      verificationLevel: 'contact_checked',
      whatsapp: providerWa,
      locationId: kuranji.id,
      ownerId: owner,
      ...extra
    })
    .returning({ id: listings.id });
  await db.insert(listingCategories).values({ listingId: l.id, categoryId, isPrimary: true });
  return l.id;
}
async function mkUnit(listingId: number, name: string) {
  const [u] = await db.insert(units).values({ listingId, name }).returning({ id: units.id });
  await db.insert(scheduleRules).values(
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      unitId: u.id,
      weekday,
      startTime: '06:00',
      endTime: '23:00',
      slotMinutes: 60,
      price: 150_000
    }))
  );
  return u.id;
}

const status = async (id: number) =>
  (await db.select({ s: bookings.status }).from(bookings).where(eq(bookings.id, id)))[0].s;
/** Hasil transisi sebagai teks: 'ok' atau alasan gagal. */
const bad = async (p: Promise<{ ok: boolean; reason?: string }>) => {
  const r = await p;
  return r.ok ? 'ok' : r.reason;
};

let failed = false;
try {
  await db.insert(user).values(
    [citizen, citizen2, owner, owner2].map((id, i) => ({
      id,
      name: `Uji Pesanan ${i}`,
      email: `pesanan-${id}@test.invalid`,
      role: i < 2 ? 'citizen' : 'vendor'
    }))
  );
  const A = await mkListing('a', padel);
  const B = await mkListing('b', padel, { ownerId: owner2 });
  const C = await mkListing('c', ac, { priceMin: 75_000 });
  const D = await mkListing('d', padel, { verificationLevel: 'unverified' });
  const E = await mkListing('e', padel, { whatsapp: null });
  const unitA = await mkUnit(A, 'Lapangan Uji 1');
  const unitB = await mkUnit(B, 'Lapangan Uji B');

  const day = addDays(jakartaDate(new Date()), 2);
  const slot = (h: number, unitId = unitA) => ({
    unitId,
    startsAt: fromJakarta(day, `${String(h).padStart(2, '0')}:00`),
    endsAt: fromJakarta(day, `${String(h + 1).padStart(2, '0')}:00`)
  });
  const input = (over: Partial<CreateBookingInput> = {}): CreateBookingInput => ({
    citizenId: citizen,
    listingId: A,
    categoryId: padel,
    districtId: kuranji.id,
    seats: 4,
    contact,
    details: { 'sewa raket': true },
    rulesAccepted: { cancelBeforeMinutes: 60 },
    ...over
  });
  const create = async (over: Partial<CreateBookingInput>) => {
    const r = await booking.createBooking(input(over));
    assert.ok(r.ok, `createBooking gagal: ${!r.ok && r.reason}`);
    return r.bookingId;
  };
  const tokenOf = (id: number) =>
    String(sentFor(id, 'booking_new')[0].params.link).split('/mitra/pesanan/t/')[1];
  const noLeak = (v: unknown) => {
    const s = JSON.stringify(v);
    assert.ok(!s.includes(contact.phone) && !s.includes(contact.address), 'kontak warga bocor');
  };
  const prov = { kind: 'provider', userId: owner } as const;
  const cit = { kind: 'citizen', userId: citizen } as const;

  // ───── 1. syarat membuat pesanan ─────
  const reason = async (over: Partial<CreateBookingInput>) => {
    const r = await booking.createBooking(input(over));
    return r.ok ? 'ok' : r.reason;
  };
  assert.equal(await reason({ categoryId: ac, slot: slot(19) }), 'listing_unavailable'); // kategori bukan milik listing
  assert.equal(await reason({ listingId: D, slot: slot(19) }), 'not_verified');
  assert.equal(await reason({ listingId: E, slot: slot(19) }), 'no_whatsapp');
  assert.equal(await reason({}), 'needs_slot');
  assert.equal(await reason({ slot: slot(19, unitB) }), 'needs_slot'); // unit listing lain
  assert.equal(await reason({ listingId: C, categoryId: ac }), 'needs_request');
  assert.equal(
    await reason({
      listingId: C,
      categoryId: ac,
      request: { problem: 'AC bocor', preferredDate: '2026-02-31', period: 'pagi' }
    }),
    'needs_request'
  );
  console.log('OK   syarat membuat pesanan');

  // ───── 2. pesanan baru + pesan ke penyedia tanpa kontak warga ─────
  const b1 = await create({ slot: slot(19) });
  const [row1] = await db.select().from(bookings).where(eq(bookings.id, b1));
  assert.equal(row1.status, 'sent');
  assert.match(row1.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.ok(row1.respondBy && row1.respondBy > new Date());
  const [n1] = sentFor(b1, 'booking_new');
  assert.ok(n1 && n1.phone === providerWa && n1.role === 'provider');
  assert.equal(n1.params.door, 'Ka main');
  assert.equal(n1.params.district, 'Kuranji');
  assert.match(String(n1.params.item), /^Lapangan Uji 1 · .+ · 19\.00–20\.00$/);
  assert.equal(n1.params.details, '4 orang · sewa raket: ya');
  noLeak(n1.params);
  const token1 = tokenOf(b1);
  assert.ok(token1.length >= 22);
  assert.equal(row1.providerTokenHash, createHash('sha256').update(token1).digest('hex'));
  assert.ok(!JSON.stringify(row1).includes(token1), 'token asli tersimpan');
  const ev1 = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, b1));
  assert.deepEqual(
    ev1.map((e) => [e.fromStatus, e.toStatus, e.actor, e.actorUserId]),
    [[null, 'sent', 'citizen', citizen]]
  );
  console.log('OK   pesanan baru, token hanya hash, pesan penyedia tanpa kontak');

  // ───── 3. slot yang sama dua kali → taken ─────
  assert.equal(await reason({ citizenId: citizen2, slot: slot(19) }), 'taken');
  const race = await Promise.all([
    booking.createBooking(input({ slot: slot(21) })),
    booking.createBooking(input({ citizenId: citizen2, slot: slot(21) }))
  ]);
  assert.deepEqual(race.map((r) => (r.ok ? 'ok' : r.reason)).toSorted(), ['ok', 'taken']);
  console.log('OK   slot sama dua kali → taken (juga bersamaan)');

  // ───── 4. privasi sebelum diterima ─────
  const pv = await booking.getBookingForProvider({ bookingId: b1, userId: owner });
  assert.ok(pv && pv.contact === null && pv.district === 'Kuranji');
  noLeak(pv);
  const tv = await booking.getBookingForProvider({ token: token1 });
  assert.ok(tv && tv.id === b1 && tv.contact === null);
  assert.equal(await booking.getBookingForProvider({ token: `${token1}x` }), null);
  assert.equal(await booking.getBookingForProvider({ token: '' }), null);
  assert.equal(await booking.getBookingForProvider({ bookingId: b1, userId: owner2 }), null);
  const list = await booking.listBookings({ listingIds: [A] });
  assert.ok(list.total >= 2 && list.items.every((i) => !('contact' in i)));
  noLeak(list);
  assert.equal(await booking.getBookingForCitizen(b1, citizen2), null);
  assert.equal((await booking.getBookingForCitizen(b1, citizen))?.code, row1.code);
  console.log('OK   privasi: sebelum diterima kontak null, token salah / pemilik lain null');

  // ───── 5. transisi ─────
  assert.equal(await bad(booking.completeBooking(b1, prov)), 'invalid_transition');
  assert.equal(await bad(booking.startBooking(b1, prov)), 'invalid_transition');
  const acc = await booking.respondBooking(b1, 'accept', { kind: 'provider' }); // lewat token, tanpa userId
  assert.ok(acc.ok && acc.status === 'accepted' && acc.notices.length === 2);
  const [bc] = sentFor(b1, 'booking_contact');
  assert.ok(bc && bc.phone === providerWa && bc.params.phone === contact.phone);
  assert.equal(sentFor(b1, 'booking_accepted')[0]?.phone, contact.phone);
  assert.equal(await bad(booking.respondBooking(b1, 'accept', prov)), 'invalid_transition');
  assert.equal(await bad(booking.respondBooking(b1, 'reject', prov)), 'invalid_transition');
  const opened = (await booking.getBookingForProvider({ token: token1 })) as ProviderBookingView;
  assert.equal(opened.contact?.phone, contact.phone);
  assert.equal(opened.contact?.address, contact.address);
  assert.equal(
    (await booking.getBookingForProvider({ bookingId: b1, userId: owner }))?.contact?.note,
    contact.note
  );
  assert.equal(await booking.getBookingForProvider({ bookingId: b1, userId: owner2 }), null);
  assert.equal((await booking.startBooking(b1, prov)).ok, true);
  // Belum boleh selesai sebelum jadwal mulai; geser jadwal uji ke masa lalu lalu selesaikan.
  assert.equal(await bad(booking.completeBooking(b1, prov)), 'invalid_transition');
  await db.execute(
    sql`update bookings set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where id = ${b1}`
  );
  const comp = await booking.completeBooking(b1, prov);
  assert.ok(comp.ok && comp.status === 'completed');
  assert.equal(sentFor(b1, 'review_request')[0]?.phone, contact.phone);
  assert.equal(await bad(booking.cancelBooking(b1, prov, 'telat')), 'invalid_transition');
  assert.equal(await bad(booking.respondBooking(999_999_999, 'accept', prov)), 'not_found');
  const view1 = await booking.getBookingForCitizen(b1, citizen);
  assert.deepEqual(
    view1?.events.map((e) => `${e.fromStatus}>${e.toStatus}:${e.actor}`),
    [
      'null>sent:citizen',
      'sent>accepted:provider',
      'accepted>in_progress:provider',
      'in_progress>completed:provider'
    ]
  );
  console.log('OK   transisi sah dan yang ditolak, riwayat tercatat');

  // ───── 6. ditolak: kontak tetap tertutup, alternatif, slot lepas ─────
  const b2 = await create({ slot: slot(20) });
  const rej = await booking.respondBooking(b2, 'reject', prov, 'Lapangan sedang diperbaiki');
  assert.ok(rej.ok && rej.status === 'rejected');
  const nr = sentFor(b2, 'booking_rejected')[0];
  assert.ok(nr && nr.phone === contact.phone && nr.params.reason === 'Lapangan sedang diperbaiki');
  assert.equal((await booking.getBookingForProvider({ token: tokenOf(b2) }))?.contact, null);
  assert.equal(
    (await booking.getBookingForProvider({ bookingId: b2, userId: owner }))?.contact,
    null
  );
  const alts = await booking.findAlternatives(b2);
  assert.ok(alts.length <= 3 && alts.some((a) => a.listingId === B), 'B harus jadi alternatif');
  assert.ok(alts.every((a) => ![A, C, D, E].includes(a.listingId)));
  console.log('OK   ditolak: kontak tetap null, alternatif tersedia');

  // ───── 7. kedaluwarsa otomatis ─────
  const b3 = await create({ slot: slot(20) }); // slot b2 sudah lepas
  await db
    .update(bookings)
    .set({ respondBy: new Date(Date.now() - 60_000) })
    .where(eq(bookings.id, b3));
  const { expired } = await booking.expireStaleBookings();
  assert.ok(expired.includes(b3));
  assert.equal(await status(b3), 'expired');
  const ev3 = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, b3));
  assert.ok(ev3.some((e) => e.toStatus === 'expired' && e.actor === 'system'));
  assert.equal(sentFor(b3, 'booking_expired')[0]?.phone, contact.phone);
  assert.equal((await booking.getBookingForProvider({ token: tokenOf(b3) }))?.contact, null);
  assert.equal(await bad(booking.respondBooking(b3, 'accept', prov)), 'too_late');
  // menjawab setelah batas waktu → too_late dan langsung kedaluwarsa
  const b4 = await create({ slot: slot(20) });
  await db
    .update(bookings)
    .set({ respondBy: new Date(Date.now() - 60_000) })
    .where(eq(bookings.id, b4));
  assert.equal(await bad(booking.respondBooking(b4, 'accept', prov)), 'too_late');
  assert.equal(await status(b4), 'expired');
  assert.equal(sentFor(b4, 'booking_expired').length, 1);
  // malas: membaca pesanan ikut mengedaluwarsakan
  const b5 = await create({ slot: slot(20) });
  await db
    .update(bookings)
    .set({ respondBy: new Date(Date.now() - 60_000) })
    .where(eq(bookings.id, b5));
  assert.equal((await booking.getBookingForCitizen(b5, citizen))?.status, 'expired');
  assert.equal(sentFor(b5, 'booking_expired').length, 1);
  console.log('OK   kedaluwarsa otomatis (tick, saat menjawab, saat dibaca) + warga diberi tahu');

  // ───── 7b. tim meneruskan ulang pesan ke penyedia (mode cadangan) ─────
  const r0 = await create({ slot: slot(11) });
  const sentBefore = sentFor(r0, 'booking_new').length;
  const re = await booking.resendProviderNotice(r0);
  assert.ok(re.ok);
  const again = sentFor(r0, 'booking_new');
  assert.equal(again.length, sentBefore + 1);
  assert.equal(again.at(-1)?.params.link, again[0]?.params.link); // tautan token sama
  assert.ok(!JSON.stringify(again.at(-1)?.params).includes('62899')); // tanpa nomor warga
  await booking.respondBooking(r0, 'reject', prov, 'Penuh');
  assert.equal(await bad(booking.resendProviderNotice(r0)), 'invalid_transition');
  console.log(
    'OK   kirim ulang pesanan ke penyedia (tautan sama, tanpa kontak, hanya saat menunggu)'
  );

  // ───── 8. pembatalan ─────
  const k0 = await create({ slot: slot(7) });
  assert.equal(
    await bad(booking.cancelBooking(k0, { kind: 'citizen', userId: citizen2 }, '')),
    'not_found'
  );
  assert.equal(await bad(booking.cancelBooking(k0, cit, '')), 'ok'); // sent: kapan saja
  await create({ slot: slot(7) }); // slot lepas setelah dibatalkan
  const k1 = await create({ slot: slot(8), rulesAccepted: { cancelBeforeMinutes: 60 } });
  await booking.respondBooking(k1, 'accept', prov);
  const c1 = await booking.cancelBooking(k1, cit, 'Ada acara');
  assert.ok(c1.ok && c1.status === 'cancelled');
  const k2 = await create({ slot: slot(9), rulesAccepted: { cancelBeforeMinutes: 4 * 24 * 60 } });
  await booking.respondBooking(k2, 'accept', prov);
  assert.equal(await bad(booking.cancelBooking(k2, cit, 'Ada acara')), 'too_late');
  assert.equal(await bad(booking.cancelBooking(k2, prov, '  ')), 'invalid_transition'); // alasan wajib
  const c2 = await booking.cancelBooking(k2, prov, 'Listrik padam');
  assert.ok(c2.ok && c2.status === 'cancelled');
  assert.equal(sentFor(k2, 'booking_cancelled')[0]?.params.reason, 'Listrik padam');
  assert.equal(sentFor(k2, 'booking_cancelled')[0]?.role, 'citizen');
  // Akun warga dihapus: sistem membatalkan walau lewat batas pembatalan, penyedia diberi tahu.
  const k4 = await create({ slot: slot(12), rulesAccepted: { cancelBeforeMinutes: 4 * 24 * 60 } });
  await booking.respondBooking(k4, 'accept', prov);
  const c4 = await booking.cancelBooking(k4, { kind: 'system' }, 'Akun pemesan dihapus');
  assert.ok(c4.ok && c4.status === 'cancelled');
  assert.equal(sentFor(k4, 'booking_cancelled')[0]?.role, 'provider');
  // Warga membatalkan pesanan yang sudah diterima: penyedia diberi tahu.
  assert.equal(sentFor(k1, 'booking_cancelled')[0]?.role, 'provider');
  assert.equal((await booking.getBookingForProvider({ token: tokenOf(k2) }))?.contact, null);
  const k3 = await create({ slot: slot(10) });
  await booking.respondBooking(k3, 'accept', prov);
  await booking.startBooking(k3, prov);
  assert.equal(await bad(booking.cancelBooking(k3, cit, 'batal')), 'invalid_transition');
  assert.equal(
    (await booking.cancelBooking(k3, { kind: 'admin', userId: null }, 'Macet')).ok,
    true
  );
  console.log('OK   pembatalan warga sebelum/sesudah batas, penyedia wajib alasan');

  // ───── 9. ulasan sekali ─────
  assert.deepEqual(await booking.submitReview(b1, citizen2, { satisfied: true }), {
    ok: false,
    reason: 'not_found'
  });
  assert.deepEqual(await booking.submitReview(k1, citizen, { satisfied: true }), {
    ok: false,
    reason: 'not_completed'
  });
  assert.deepEqual(await booking.submitReview(b1, citizen, { satisfied: true, stars: 5 }), {
    ok: true
  });
  assert.deepEqual(await booking.submitReview(b1, citizen, { satisfied: false }), {
    ok: false,
    reason: 'already_reviewed'
  });
  assert.equal((await booking.getBookingForCitizen(b1, citizen))?.review?.stars, 5);
  console.log('OK   ulasan hanya untuk pesanan selesai, sekali');

  // ───── 10. permintaan tanpa jadwal (Ka servis) ─────
  const r1 = await create({
    listingId: C,
    categoryId: ac,
    seats: 1,
    details: {},
    request: { problem: 'AC tidak dingin', preferredDate: day, period: 'pagi' }
  });
  const [rr] = await db.select().from(bookings).where(eq(bookings.id, r1));
  assert.ok(rr.unitId === null && rr.startsAt === null && rr.price === 75_000);
  const nn = sentFor(r1, 'booking_new')[0];
  assert.match(String(nn.params.item), /^Servis AC · .+ · pagi$/);
  assert.equal(nn.params.details, 'Keluhan: AC tidak dingin');
  assert.equal(nn.params.door, 'Ka servis');
  console.log('OK   permintaan Ka servis');

  // ───── 11. pengingat dan selesai otomatis ─────
  const now = Date.now();
  await db
    .update(bookings)
    .set({ createdAt: new Date(now - 20 * 60_000), respondBy: new Date(now + 10 * 60_000) })
    .where(eq(bookings.id, r1));
  const a4 = await create({ slot: slot(11) });
  await booking.respondBooking(a4, 'accept', prov);
  await db
    .update(bookings)
    .set({ startsAt: new Date(now - 4 * 3.6e6), endsAt: new Date(now - 3 * 3.6e6) })
    .where(eq(bookings.id, a4));
  const a5 = await create({ slot: slot(12) });
  await booking.respondBooking(a5, 'accept', prov);
  const before = await getSetting('booking.reminder_minutes_before');
  await db
    .update(bookings)
    .set({
      startsAt: new Date(now + (before / 2) * 60_000),
      endsAt: new Date(now + (before / 2 + 60) * 60_000)
    })
    .where(eq(bookings.id, a5));
  await booking.runReminders();
  const pr = sentFor(r1, 'booking_reminder_provider');
  assert.ok(
    pr.length === 1 && pr[0].phone === providerWa && Number(pr[0].params.minutesLeft) <= 10
  );
  // pengingat memuat tautan token yang sama dengan pesan pertama (tombol Terima/Tolak tetap jalan)
  assert.equal(pr[0].params.link, sentFor(r1, 'booking_new')[0].params.link);
  assert.ok(await booking.getBookingForProvider({ token: tokenOf(r1) }));
  assert.equal(await status(a4), 'completed');
  assert.equal(sentFor(a4, 'review_request').length, 1);
  assert.equal(sentFor(a5, 'booking_reminder')[0]?.phone, contact.phone);
  await booking.runReminders(); // tidak mengirim dua kali
  assert.equal(sentFor(r1, 'booking_reminder_provider').length, 1);
  assert.equal(sentFor(a5, 'booking_reminder').length, 1);
  assert.equal(sentFor(a4, 'review_request').length, 1);
  console.log('OK   pengingat penyedia/warga dan selesai otomatis, masing-masing sekali');

  // kontak tersimpan terpisah, tidak di tabel bookings
  const [bc1] = await db.select().from(bookingContacts).where(eq(bookingContacts.bookingId, b1));
  assert.equal(bc1.phone, contact.phone);
  noLeak(await db.select().from(bookings).where(eq(bookings.id, b1)));
} catch (e) {
  failed = true;
  console.error('GAGAL', e);
} finally {
  // Bersihkan data uji (pesanan ikut terhapus lewat listing; dihapus dulu agar unit bebas).
  const ids = (
    await db
      .select({ id: listings.id })
      .from(listings)
      .where(like(listings.slug, `${tag}-%`))
  ).map((l) => l.id);
  if (ids.length) {
    await db.delete(bookings).where(inArray(bookings.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
  }
  await db.delete(user).where(inArray(user.id, [citizen, citizen2, owner, owner2]));
}
console.log(
  failed ? '\nbooking.check: GAGAL' : `\nbooking.check: OK${realHold ? '' : ' (holdSlot tiruan)'}`
);
process.exit(failed ? 1 : 0);
