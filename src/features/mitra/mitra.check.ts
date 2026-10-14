// Pemeriksaan dashboard mitra. Bagian 1 murni (validasi jam buka, penyaring tombol WA); bagian 2 memakai
// DATABASE SUNGGUHAN (kamanga_v2): membuat akun …@test.invalid dan listing test-mitra-…, lalu menghapusnya.
// Prasyarat: data acuan (db:seed-reference). WA tidak dikirim: notify.sendWa diganti tiruan.
// Jalankan: bun run src/features/mitra/mitra.check.ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  categories,
  listingCategories,
  listingQa,
  listings,
  locations,
  slotBlocks,
  user
} from '@/db/schema';
import { booking, notify, type WaSendResult, type WaTemplate } from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { emptyListingForm } from '@/features/listings/schemas/listing';
import { getMyListing, saveMyListing } from '@/features/vendor/api/repository';
import { actOnBooking } from './api/bookings';
import * as repo from './api/repository';
import { citizenNotices } from './lib/notices';
import { checkPatterns, emptyPattern, expandPatterns, groupRules, type Pattern } from './schemas';

// ───────────────────────────── 1. Murni ─────────────────────────────

const pat = (over: Partial<Pattern>): Pattern => ({ ...emptyPattern('slot'), ...over });
const issues = (kind: 'slot' | 'seat', ps: Pattern[]) =>
  checkPatterns(kind, ps).map((i) => `${i.index}.${i.field}`);

// Jam buka valid: dua interval sehari (istirahat), bersebelahan boleh.
assert.deepEqual(
  issues('slot', [
    pat({ days: ['1'], start: '08:00', end: '12:00' }),
    pat({ days: ['1'], start: '12:00', end: '22:00' })
  ]),
  []
);
// Bertumpuk di hari yang sama.
assert.deepEqual(
  issues('slot', [
    pat({ days: ['1', '2'], start: '08:00', end: '12:00' }),
    pat({ days: ['2'], start: '11:00', end: '13:00' })
  ]),
  ['1.start']
);
// Lewat tengah malam Sabtu → Minggu dini hari (putaran minggu).
assert.deepEqual(
  issues('slot', [
    pat({ days: ['6'], start: '22:00', end: '02:00' }),
    pat({ days: ['0'], start: '01:00', end: '05:00' })
  ]),
  ['1.start']
);
assert.deepEqual(
  issues('slot', [
    pat({ days: ['6'], start: '22:00', end: '02:00' }),
    pat({ days: ['0'], start: '02:00', end: '05:00' })
  ]),
  []
);
assert.deepEqual(issues('slot', [pat({ start: '08:00', end: '08:30', slotMinutes: 60 })]), [
  '0.slotMinutes'
]);
assert.deepEqual(issues('slot', [pat({ minMinutes: 30, slotMinutes: 60 })]), ['0.minMinutes']);
assert.deepEqual(issues('slot', [pat({ end: '' })]), ['0.end']);
assert.deepEqual(issues('slot', [pat({ peakPrice: 200_000 })]), ['0.peakStart', '0.peakEnd']);
assert.deepEqual(
  issues('slot', [pat({ peakPrice: 200_000, peakStart: '18:00', peakEnd: '22:00' })]),
  []
);
// Travel: keberangkatan ganda di hari & jam yang sama ditolak; jam tutup tidak perlu.
const dep = (over: Partial<Pattern>): Pattern => ({ ...emptyPattern('seat'), ...over });
assert.deepEqual(issues('seat', [dep({ days: ['1'] }), dep({ days: ['1', '2'] })]), ['1.start']);
assert.deepEqual(issues('seat', [dep({ start: '07:00' }), dep({ start: '13:00' })]), []);
// Bolak-balik pola ↔ baris.
const ps = [
  pat({ days: ['1', '2', '3'], start: '08:00', end: '22:00', price: 100_000 }),
  pat({ days: ['6'], start: '18:00', end: '02:00', price: 150_000 })
];
const rows = expandPatterns('slot', ps);
assert.equal(rows.length, 4);
assert.deepEqual(
  groupRules(
    rows.map((r) => ({ ...r, startTime: `${r.startTime}:00`, endTime: `${r.endTime}:00` }))
  ),
  ps
);
const seatRows = expandPatterns('seat', [dep({ days: ['5'], start: '22:00', slotMinutes: 210 })]);
assert.equal(seatRows[0].endTime, '01:30'); // jam tiba lewat tengah malam

// Tombol "Kabari pemesan": hanya pesan ke nomor warga, dan hanya bila kontak terbuka.
const n = (phone: string): WaSendResult => ({
  mode: 'fallback',
  status: 'link',
  messageId: 1,
  link: `https://wa.me/${phone}?text=x`,
  text: 'x'
});
assert.deepEqual(
  citizenNotices([n('6281111111111'), n('6282222222222')], '6282222222222', '6281111111111').map(
    (x) => x.link
  ),
  ['https://wa.me/6282222222222?text=x']
);
assert.deepEqual(citizenNotices([n('6282222222222')], null, '6281111111111'), []);
console.log('1. murni: lulus');

// ───────────────────────────── 2. Database ─────────────────────────────

type Sent = { template: WaTemplate; phone: string; params: Record<string, unknown> };
const sent: Sent[] = [];
notify.sendWa = (async (template, to, params) => {
  sent.push({ template, phone: to.phone, params: params as Record<string, unknown> });
  return {
    mode: 'fallback',
    status: 'link',
    messageId: sent.length,
    link: `https://wa.me/${to.phone}?text=${template}`,
    text: template
  };
}) as typeof notify.sendWa;

const tag = `test-mitra-${Date.now().toString(36)}`;
const [ownerA, ownerB, admin, citizen] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const citizenPhone = '6289900077711';
const providerWa = '6281200077701';
const ids: number[] = [];

const catId = async (slug: string) =>
  (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)))[0].id;
const ok = <T extends { ok: boolean }>(r: T, what: string) => {
  assert.ok(r.ok, `${what}: ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};
const no = (r: { ok: boolean }, what: string) =>
  assert.equal(r.ok, false, `${what} seharusnya ditolak`);

let failed = false;
try {
  const [kuranji] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.name, 'Kuranji'), eq(locations.level, 'district')));
  assert.ok(kuranji, 'butuh data acuan lokasi (Kuranji)');
  await db.insert(user).values(
    [
      [ownerA, 'vendor'],
      [ownerB, 'vendor'],
      [admin, 'admin'],
      [citizen, 'citizen']
    ].map(([id, role], i) => ({
      id,
      name: `Uji Mitra ${i}`,
      email: `mitra-${id}@test.invalid`,
      role,
      phoneNumber: role === 'citizen' ? citizenPhone : null
    }))
  );
  const mk = async (suffix: string, owner: string, cat: string) => {
    const [l] = await db
      .insert(listings)
      .values({
        slug: `${tag}-${suffix}`,
        name: `[UJI] Mitra ${suffix}`,
        status: 'published',
        verificationLevel: 'contact_checked',
        whatsapp: providerWa,
        locationId: kuranji.id,
        ownerId: owner
      })
      .returning({ id: listings.id });
    await db
      .insert(listingCategories)
      .values({ listingId: l.id, categoryId: await catId(cat), isPrimary: true });
    ids.push(l.id);
    return l.id;
  };
  const A = await mk('a', ownerA, 'padel-court');
  const B = await mk('b', ownerB, 'padel-court');
  const T = await mk('t', ownerA, 'intercity-travel');

  // ───── hak akses ─────
  assert.equal(await repo.canEdit({ id: ownerA, role: 'vendor' }, A), true);
  assert.equal(await repo.canEdit({ id: ownerB, role: 'vendor' }, A), false);
  assert.equal(await repo.canEdit({ id: admin, role: 'admin' }, A), true);
  assert.equal(await repo.canEdit({ id: citizen, role: 'citizen' }, A), false);
  assert.deepEqual(
    (await repo.ownedListings(ownerB)).map((l) => l.id),
    [B]
  );

  // ───── unit & jam buka ─────
  const unitIn = {
    name: 'Lapangan Uji',
    capacity: 4,
    originLocationId: '',
    destinationLocationId: ''
  };
  const uA = ok(await repo.saveUnit(A, null, unitIn), 'tambah unit A').id;
  const uB = ok(await repo.saveUnit(B, null, unitIn), 'tambah unit B').id;
  no(await repo.saveUnit(B, uA, { ...unitIn, name: 'Curian' }), 'B mengubah unit A');
  no(await repo.setUnitActive(B, uA, false), 'B menonaktifkan unit A');
  const allWeek = pat({
    days: ['0', '1', '2', '3', '4', '5', '6'],
    start: '08:00',
    end: '22:00',
    price: 120_000
  });
  no(await repo.replaceRules(B, uA, [allWeek]), 'B mengatur jam buka unit A');
  no(
    await repo.replaceRules(A, uA, [allWeek, pat({ days: ['1'], start: '21:00', end: '23:00' })]),
    'jam buka bertumpuk'
  );
  ok(await repo.replaceRules(A, uA, [allWeek]), 'jam buka A');
  ok(await repo.replaceRules(B, uB, [allWeek]), 'jam buka B');
  const editor = await repo.scheduleEditorData(A, 'vendor');
  assert.equal(editor?.units[0].capacity, 1, 'unit slot selalu berkapasitas 1');
  assert.deepEqual(editor?.units[0].patterns, [allWeek]);

  // ───── kalender & blokir dua ketukan ─────
  const day = addDays(jakartaDate(new Date()), 2);
  assert.equal(await repo.calendar(B, uA, day, 'vendor'), null, 'B membaca kalender unit A');
  const cal = (await repo.calendar(A, uA, day, 'vendor'))!;
  assert.equal(cal.length, 14);
  const ten = cal.find((s) => s.startsAt.getTime() === fromJakarta(day, '10:00').getTime())!;
  assert.equal(ten.state, 'free');
  const blockIn = {
    unitId: uA,
    startsAt: ten.startsAt,
    endsAt: ten.endsAt,
    reason: 'walk_in',
    note: ''
  };
  no(await repo.blockSlot(B, blockIn, { kind: 'provider', userId: ownerB }), 'B memblokir unit A');
  const blockId = ok(
    await repo.blockSlot(A, blockIn, { kind: 'provider', userId: ownerA }),
    'blokir A'
  ).id;
  const ten2 = (await repo.calendar(A, uA, day, 'vendor'))!.find(
    (s) => s.startsAt.getTime() === ten.startsAt.getTime()
  )!;
  assert.equal(ten2.state, 'blocked');
  assert.equal(ten2.block?.id, blockId);
  no(
    await repo.unblockSlot(B, blockId, { kind: 'provider', userId: ownerB }),
    'B membuka blokir A'
  );
  ok(await repo.unblockSlot(A, blockId, { kind: 'provider', userId: ownerA }), 'buka blokir A');

  // Travel: blokir satu keberangkatan = [jam berangkat, +1 menit).
  const uT = ok(
    await repo.saveUnit(T, null, { ...unitIn, name: 'Padang → Solok', capacity: 8 }),
    'rute travel'
  ).id;
  ok(
    await repo.replaceRules(T, uT, [
      dep({
        days: ['0', '1', '2', '3', '4', '5', '6'],
        start: '07:00',
        slotMinutes: 120,
        price: 80_000
      })
    ]),
    'keberangkatan'
  );
  const depAt = fromJakarta(day, '07:00');
  const tb = ok(
    await repo.blockSlot(
      T,
      {
        unitId: uT,
        startsAt: depAt,
        endsAt: fromJakarta(day, '09:00'),
        reason: 'whatsapp',
        note: ''
      },
      { kind: 'provider', userId: ownerA }
    ),
    'blokir keberangkatan'
  );
  const [tbRow] = await db.select().from(slotBlocks).where(eq(slotBlocks.id, tb.id));
  assert.equal(tbRow.endsAt.getTime() - tbRow.startsAt.getTime(), 60_000);
  const tcal = (await repo.calendar(T, uT, day, 'vendor'))!;
  assert.equal(tcal[0].state, 'blocked');
  assert.equal(tcal[0].capacity, 8);

  // ───── pengecualian ─────
  no(
    await repo.saveException(B, {
      date: day,
      unitId: String(uA),
      closed: true,
      start: '',
      end: '',
      note: ''
    }),
    'B menutup unit A'
  );
  no(
    await repo.saveException(A, {
      date: '2020-01-01',
      unitId: '',
      closed: true,
      start: '',
      end: '',
      note: ''
    }),
    'tanggal lewat'
  );
  ok(
    await repo.saveException(A, {
      date: day,
      unitId: '',
      closed: false,
      start: '10:00',
      end: '12:00',
      note: ''
    }),
    'jam khusus A'
  );
  assert.equal((await repo.calendar(A, uA, day, 'vendor'))!.length, 2);
  const exId = (await repo.scheduleEditorData(A, 'vendor'))!.exceptions[0].id;
  no(await repo.deleteException(B, exId), 'B menghapus pengecualian A');
  ok(await repo.deleteException(A, exId), 'hapus pengecualian A');

  // ───── tanya jawab ─────
  ok(
    await repo.saveQa(A, null, { question: 'Ada parkir mobil?', answer: 'Ada, muat 10 mobil.' }),
    'qa'
  );
  ok(await repo.saveQa(A, null, { question: 'Boleh bawa raket?', answer: 'Boleh.' }), 'qa 2');
  const qa = (await repo.qaData(A, 'vendor'))!;
  assert.deepEqual(
    qa.items.map((q) => q.question),
    ['Ada parkir mobil?', 'Boleh bawa raket?']
  );
  no(
    await repo.saveQa(B, qa.items[0].id, { question: 'Diubah B', answer: 'x' }),
    'B mengubah QA A'
  );
  no(await repo.deleteQa(B, qa.items[0].id), 'B menghapus QA A');
  no(await repo.moveQa(B, qa.items[1].id, -1), 'B mengurutkan QA A');
  ok(await repo.moveQa(A, qa.items[1].id, -1), 'urutkan QA A');
  assert.equal((await repo.qaData(A, 'vendor'))!.items[0].question, 'Boleh bawa raket?');
  // Pertanyaan warga: dijawab → dikirim ke warga; tautan wa.me (memuat nomor warga) hanya untuk admin.
  const [q1] = await db
    .insert(listingQa)
    .values({ listingId: A, question: 'Buka saat hujan?', source: 'citizen', askedBy: citizen })
    .returning({ id: listingQa.id });
  const [q2] = await db
    .insert(listingQa)
    .values({ listingId: A, question: 'Ada kantin?', source: 'citizen', askedBy: citizen })
    .returning({ id: listingQa.id });
  assert.equal(await repo.pendingQuestionCount(A), 2);
  no(await repo.answerQuestion(B, q1.id, { answer: 'Ya' }, 'vendor'), 'B menjawab pertanyaan A');
  const av = ok(await repo.answerQuestion(A, q1.id, { answer: 'Tetap buka.' }, 'vendor'), 'jawab');
  assert.equal(av.notified, 'link');
  assert.equal(av.link, null, 'mitra tidak boleh menerima tautan berisi nomor warga');
  const aa = ok(await repo.answerQuestion(A, q2.id, { answer: 'Ada.' }, 'admin'), 'jawab admin');
  assert.ok(aa.link?.includes(citizenPhone));
  assert.equal(sent.filter((s) => s.template === 'question_answered').length, 2);
  no(await repo.answerQuestion(A, q1.id, { answer: 'Lagi' }, 'vendor'), 'menjawab dua kali');

  // ───── pesanan: kepemilikan dan privasi kontak ─────
  const padel = await catId('padel-court');
  const contact = { name: 'Warga Uji', phone: citizenPhone, address: 'Jl. Rahasia 7', note: null };
  const create = async (h: string) => {
    const r = await booking.createBooking({
      citizenId: citizen,
      listingId: A,
      categoryId: padel,
      slot: {
        unitId: uA,
        startsAt: fromJakarta(day, h),
        endsAt: fromJakarta(day, `${Number(h.slice(0, 2)) + 1}:00`)
      },
      districtId: kuranji.id,
      contact,
      rulesAccepted: {}
    });
    assert.ok(r.ok, `createBooking: ${!r.ok && r.reason}`);
    return r.bookingId;
  };
  const b1 = await create('14:00');
  const b2 = await create('16:00');
  const token = String(
    sent.findLast((s) => s.template === 'booking_new' && s.params.code)!.params.link
  ).split('/mitra/pesanan/t/')[1];
  const noLeak = (v: unknown) => {
    const s = JSON.stringify(v);
    assert.ok(!s.includes(citizenPhone) && !s.includes('Rahasia'), 'kontak warga bocor');
  };

  // Mitra lain tidak bisa membaca / mengubah pesanan A.
  assert.equal(await booking.getBookingForProvider({ bookingId: b1, userId: ownerB }), null);
  no(
    await actOnBooking({ bookingId: b1, userId: ownerB }, { action: 'accept' }),
    'B menerima pesanan A'
  );
  // Pemilik sebelum menerima: hanya kecamatan.
  const before = await booking.getBookingForProvider({ bookingId: b1, userId: ownerA });
  assert.equal(before?.contact, null);
  assert.equal(before?.district, 'Kuranji');
  noLeak(before);

  // Halaman token: kontak tertutup sebelum diterima, token tidak bisa membatalkan.
  const viaToken = await booking.getBookingForProvider({ token });
  assert.equal(viaToken?.id, b2);
  assert.equal(viaToken?.contact, null);
  noLeak(viaToken);
  no(await actOnBooking({ token }, { action: 'cancel', reason: 'iseng' }), 'batal lewat token');
  no(await actOnBooking({ token: `${token}x` }, { action: 'accept' }), 'token palsu');
  const acc = ok(await actOnBooking({ token }, { action: 'accept' }), 'terima lewat token');
  assert.equal(acc.status, 'accepted');
  // Hanya pesan untuk warga (booking_accepted) yang jadi tombol; booking_contact untuk penyedia dibuang.
  assert.deepEqual(
    acc.notices.map((x) => x.link),
    [`https://wa.me/${citizenPhone}?text=booking_accepted`]
  );
  assert.equal((await booking.getBookingForProvider({ token }))?.contact?.phone, citizenPhone);

  // Tolak oleh pemilik: kontak tidak pernah terbuka → tanpa tombol berisi nomor warga.
  const rej = ok(
    await actOnBooking(
      { bookingId: b1, userId: ownerA },
      { action: 'reject', reason: 'Sudah penuh' }
    ),
    'tolak'
  );
  assert.deepEqual(rej.notices, []);
  noLeak(rej);
  // Batal wajib beralasan; batal setelah diterima boleh mengabari warga.
  no(
    await actOnBooking({ bookingId: b2, userId: ownerA }, { action: 'cancel', reason: '' }),
    'batal tanpa alasan'
  );
  ok(await actOnBooking({ bookingId: b2, userId: ownerA }, { action: 'start' }), 'mulai');
  const done = ok(
    await actOnBooking({ bookingId: b2, userId: ownerA }, { action: 'complete' }),
    'selesai'
  );
  assert.deepEqual(
    done.notices.map((x) => x.link),
    [`https://wa.me/${citizenPhone}?text=review_request`]
  );

  // ───── beranda & statistik ─────
  const since = fromJakarta(`${jakartaDate(new Date()).slice(0, 8)}01`, '00:00');
  const month = await repo.monthSummary(A, since);
  assert.deepEqual(month, { booked: 2, accepted: 1, completed: 1, newCustomers: 1 });
  const st = await repo.stats(A);
  assert.equal(st.booked, 2);
  assert.equal(st.accepted, 1);
  assert.equal(st.answered, 2);
  assert.deepEqual(st.peakHours, [{ hour: 16, count: 1 }]);
  assert.ok((await repo.missingAttributes(A)).includes('Durasi minimal'));

  // ───── portal vendor: isian khusus tim tidak bisa diubah lewat request buatan ─────
  const forged = {
    kind: 'place' as const,
    status: 'published' as const,
    verificationLevel: 'visited' as const,
    source: 'team' as const,
    sourceUrl: 'https://contoh.test',
    reviewNote: 'palsu'
  };
  const created = await saveMyListing(
    ownerB,
    null,
    {
      ...emptyListingForm,
      name: `${tag} baru`,
      slug: `${tag}-baru`,
      primaryCategoryId: String(padel),
      ...forged
    },
    'draft'
  );
  assert.ok(created.ok, JSON.stringify(created));
  ids.push(created.id);
  const [nl] = await db.select().from(listings).where(eq(listings.id, created.id));
  assert.deepEqual(
    [nl.kind, nl.status, nl.verificationLevel, nl.source, nl.ownerId],
    ['provider', 'draft', 'unverified', 'vendor', ownerB]
  );
  await db.update(listings).set({ summary: 'Lapangan padel uji.' }).where(eq(listings.id, A));
  const detailA = (await getMyListing(ownerA, A))!;
  assert.equal(await getMyListing(ownerB, A), null, 'B membaca listing A');
  const stolen = await saveMyListing(ownerB, A, { ...detailA.values, ...forged }, 'submit');
  assert.equal(stolen.ok, false, 'B mengubah listing A');
  const upd = await saveMyListing(ownerA, A, { ...detailA.values, ...forged }, 'submit');
  assert.ok(upd.ok, JSON.stringify(upd));
  const [al] = await db.select().from(listings).where(eq(listings.id, A));
  assert.deepEqual(
    [al.kind, al.status, al.verificationLevel],
    ['provider', 'published', 'contact_checked']
  );
  console.log('2. database: lulus');
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  if (ids.length) {
    await db.delete(bookings).where(inArray(bookings.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
  }
  await db.delete(user).where(inArray(user.id, [ownerA, ownerB, admin, citizen]));
  await db.$client.end();
}
if (failed) process.exit(1);
console.log('mitra.check: semua lulus');
