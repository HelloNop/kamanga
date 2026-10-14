// Pemeriksaan logika panel admin (agent-ui-admin): urutan pintu, penilaian pesanan macet, template WA,
// pengaturan, dan kueri pesanan admin terhadap DATABASE SUNGGUHAN (kamanga_v2, butuh data acuan).
// Data uji ber-slug test-admin-… dihapus di akhir; urutan pintu dan app_settings dikembalikan seperti semula.
// Jalankan: bun run src/features/bookings/admin.check.ts   (usulan script: check:admin)
import assert from 'node:assert/strict';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '@/db';
import {
  appSettings,
  bookingContacts,
  bookings,
  categories,
  doors,
  listings,
  user
} from '@/db/schema';
import * as doorRepo from '@/features/doors/api/repository';
import { doorFormSchema, emptyDoorForm, moveInOrder } from '@/features/doors/schemas/door';
import * as settingsRepo from '@/features/settings/api/repository';
import { templateProblem } from '@/features/settings/lib/templates';
import { settingsFormSchema } from '@/features/settings/schemas/settings';
import * as bookingRepo from './api/repository';
import { stuckReason, whenText } from './lib/status';

const TAG = 'test-admin';
const MIN = 60_000;
let failed = false;
const ok = (msg: string) => console.log(`OK   ${msg}`);

// ───── murni ─────
assert.deepEqual(moveInOrder([1, 2, 3], 2, 'up'), [2, 1, 3]);
assert.deepEqual(moveInOrder([1, 2, 3], 2, 'down'), [1, 3, 2]);
assert.equal(moveInOrder([1, 2, 3], 1, 'up'), null);
assert.equal(moveInOrder([1, 2, 3], 3, 'down'), null);
assert.equal(moveInOrder([1, 2, 3], 9, 'up'), null);
ok('moveInOrder: geser naik/turun, ujung daftar ditolak');

const door = (v: Partial<typeof emptyDoorForm>) =>
  doorFormSchema.safeParse({ ...emptyDoorForm, name: 'Ka coba', ...v }).success;
assert.ok(door({ icon: 'ballFootball', slug: 'ka-coba' }));
assert.ok(door({ icon: '' }));
assert.ok(!door({ icon: 'bukanIkon' }));
assert.ok(!door({ slug: 'Ka Coba' }));
assert.ok(!door({ name: 'K' }));
ok('doorFormSchema: ikon hanya kunci Icons, slug huruf kecil');

const now = new Date('2026-10-15T05:00:00Z'); // 12.00 WIB
const base = { details: {}, respondBy: null, endsAt: null };
assert.match(
  stuckReason({ ...base, status: 'sent', respondBy: new Date(now.getTime() + 5 * MIN) }, now)!,
  /sisa 5 menit/
);
assert.equal(
  stuckReason({ ...base, status: 'sent', respondBy: new Date(now.getTime() + 30 * MIN) }, now),
  null
);
assert.ok(stuckReason({ ...base, status: 'accepted', endsAt: new Date(now.getTime() - MIN) }, now));
assert.equal(
  stuckReason({ ...base, status: 'accepted', endsAt: new Date(now.getTime() + MIN) }, now),
  null
);
assert.ok(
  stuckReason({ ...base, status: 'in_progress', details: { preferredDate: '2026-10-14' } }, now)
);
assert.equal(
  stuckReason({ ...base, status: 'accepted', details: { preferredDate: '2026-10-15' } }, now),
  null
);
assert.equal(
  stuckReason({ ...base, status: 'completed', endsAt: new Date(now.getTime() - MIN) }, now),
  null
);
ok('stuckReason: hampir kedaluwarsa, lewat jadwal, lewat tanggal permintaan');

assert.equal(
  whenText({
    startsAt: new Date('2026-10-18T12:00:00Z'),
    endsAt: new Date('2026-10-18T13:00:00Z'),
    details: {}
  }),
  'Minggu, 18 Okt · 19.00–20.00'
);
assert.equal(
  whenText({
    startsAt: null,
    endsAt: null,
    details: { preferredDate: '2026-10-18', period: 'pagi' }
  }),
  'Minggu, 18 Okt · pagi'
);
ok('whenText: slot dan permintaan servis');

assert.equal(templateProblem('booking_new', ''), null);
assert.equal(templateProblem('booking_new', 'Pesanan {code} di {listing}: {link}'), null);
assert.match(templateProblem('booking_new', 'Pesanan {kode}: {link}')!, /\{kode\} tidak dikenal/);
assert.match(templateProblem('booking_new', 'Pesanan {code}')!, /Wajib memuat \{link\}/);
assert.match(templateProblem('question_new', 'Tanya: {question}')!, /\{link\}/);
const settings = (v: Record<string, unknown>) =>
  settingsFormSchema.safeParse({
    defaultResponseMinutes: 30,
    reminderMinutesBefore: 120,
    waTemplates: {},
    ...v
  }).success;
assert.ok(settings({}));
assert.ok(!settings({ defaultResponseMinutes: 2 }));
assert.ok(!settings({ waTemplates: { otp: 'Kode {code}' } }), 'OTP tidak boleh diubah');
assert.ok(!settings({ waTemplates: { booking_new: 'tanpa tautan {code}' } }));
ok('template WA: penanda dikenal, {link}/{code} wajib, OTP tidak bisa diubah');

// ───── database ─────
const doorsBefore = await db.select({ id: doors.id, sortOrder: doors.sortOrder }).from(doors);
const KEYS = [
  'booking.default_response_minutes',
  'booking.reminder_minutes_before',
  'wa.templates'
];
const settingsBefore = await db.select().from(appSettings).where(inArray(appSettings.key, KEYS));
let testDoorId: number | null = null;
try {
  // Pintu: buat, sebutan bentrok ditolak, geser urutan.
  const created = await doorRepo.createDoor({
    ...emptyDoorForm,
    name: 'Ka uji admin',
    slug: `${TAG}-pintu`,
    icon: 'tool',
    aliases: ['uji admin pintu']
  });
  assert.ok(created.ok);
  testDoorId = created.id;
  const clash = await doorRepo.createDoor({
    ...emptyDoorForm,
    name: 'Ka bentrok',
    slug: `${TAG}-bentrok`,
    aliases: ['Uji Admin Pintu']
  });
  assert.ok(!clash.ok && /sudah dipakai Ka uji admin/.test(clash.message));
  let list = await doorRepo.listDoors();
  assert.equal(list.at(-1)?.id, testDoorId, 'pintu baru di urutan terakhir');
  assert.ok((await doorRepo.moveDoor(testDoorId, 'up')).ok);
  list = await doorRepo.listDoors();
  assert.equal(list.at(-2)?.id, testDoorId);
  assert.deepEqual(
    list.map((d) => d.sortOrder),
    list.map((_, i) => (i + 1) * 10),
    'urutan ditulis ulang 10, 20, …'
  );
  assert.ok(!(await doorRepo.moveDoor(list[0].id, 'up')).ok);
  ok('pintu: dibuat di akhir, sebutan bentrok ditolak, naik/turun menulis ulang urutan');

  // Pesanan: data uji langsung di tabel (tanpa mesin), lalu dibaca lewat repository admin.
  const [cat] = await db.select({ id: categories.id }).from(categories).limit(1);
  const [l] = await db
    .insert(listings)
    .values({
      slug: `${TAG}-listing`,
      name: '[TEST-ADMIN] Penyedia uji',
      whatsapp: '6281200000001'
    })
    .returning({ id: listings.id });
  const t = Date.now();
  const mk = (code: string, v: Partial<typeof bookings.$inferInsert>) => ({
    code: `TA${code}${String(t).slice(-4)}`,
    listingId: l.id,
    categoryId: cat.id,
    ...v
  });
  const rows = await db
    .insert(bookings)
    .values([
      mk('S1', { status: 'sent', respondBy: new Date(t + 5 * MIN) }),
      mk('S2', { status: 'sent', respondBy: new Date(t + 60 * MIN) }),
      mk('A1', {
        status: 'accepted',
        startsAt: new Date(t - 3 * 60 * MIN),
        endsAt: new Date(t - 2 * 60 * MIN)
      }),
      mk('A2', { status: 'accepted', details: { preferredDate: '2020-01-01', period: 'pagi' } }),
      mk('C1', {
        status: 'completed',
        startsAt: new Date(t - 5 * 60 * MIN),
        endsAt: new Date(t - 4 * 60 * MIN)
      })
    ])
    .returning({ id: bookings.id, code: bookings.code });
  const id = (c: string) => rows.find((r) => r.code.startsWith(`TA${c}`))!.id;
  await db.insert(bookingContacts).values({
    bookingId: id('S1'),
    name: 'Warga Uji',
    phone: '6281200000002',
    address: 'Jl. Uji 1'
  });

  const stuck = await bookingRepo.listAdminBookings({ flag: 'stuck', listing: '[TEST-ADMIN]' });
  assert.deepEqual(
    stuck.items.map((b) => b.id).toSorted((a, b) => a - b),
    [id('S1'), id('A1'), id('A2')].toSorted((a, b) => a - b)
  );
  assert.equal(stuck.total, 3);
  const all = await bookingRepo.listAdminBookings({ listing: '[TEST-ADMIN]', limit: 2 });
  assert.equal(all.total, 5);
  assert.equal(all.items.length, 2, 'paginasi');
  const sentOnly = await bookingRepo.listAdminBookings({ listing: '[TEST-ADMIN]', status: 'sent' });
  assert.equal(sentOnly.total, 2);
  const stuckCompleted = await bookingRepo.listAdminBookings({
    listing: '[TEST-ADMIN]',
    status: 'completed',
    flag: 'stuck'
  });
  assert.equal(stuckCompleted.total, 0, 'pesanan selesai tidak pernah macet');
  ok('pesanan admin: filter macet, status, nama listing, paginasi');

  const queue = (await bookingRepo.listForwardQueue()).filter((b) => b.listing.id === l.id);
  assert.deepEqual(
    queue.map((b) => b.id),
    [id('S1'), id('S2')],
    'antrean urut sisa waktu tersingkat'
  );
  ok('antrean "Perlu diteruskan": pesanan menunggu jawaban, sisa waktu tersingkat dulu');

  const detail = await bookingRepo.getAdminBooking(id('S1'));
  assert.equal(
    detail?.contact?.phone,
    '6281200000002',
    'admin melihat kontak walau belum diterima'
  );
  assert.ok(detail?.stuck);
  assert.ok(await bookingRepo.saveAdminNote(id('S1'), '  sudah ditelepon  '));
  assert.equal((await bookingRepo.getAdminBooking(id('S1')))?.adminNote, 'sudah ditelepon');
  assert.ok(await bookingRepo.saveAdminNote(id('S1'), '   '));
  assert.equal((await bookingRepo.getAdminBooking(id('S1')))?.adminNote, null);
  ok('detail pesanan admin: kontak terbaca, catatan admin disimpan/dikosongkan');

  // Pengaturan: simpan, baca ulang (template kosong = bawaan, tidak disimpan), tolak yang salah.
  const [adm] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'admin')).limit(1);
  assert.ok(adm, 'butuh akun admin (bun run auth:create-admin)');
  const values = await settingsRepo.getSettingsValues();
  assert.equal(values.waTemplates.otp, undefined, 'OTP tidak ada di formulir');
  const saved = await settingsRepo.saveSettings(adm.id, {
    defaultResponseMinutes: 45,
    reminderMinutesBefore: 90,
    waTemplates: {
      ...values.waTemplates,
      question_new: 'Ada pertanyaan untuk {listing}: {question} {link}'
    }
  });
  assert.ok(saved.ok);
  const again = await settingsRepo.getSettingsValues();
  assert.equal(again.defaultResponseMinutes, 45);
  assert.equal(again.reminderMinutesBefore, 90);
  assert.match(again.waTemplates.question_new, /^Ada pertanyaan/);
  const [stored] = await db.select().from(appSettings).where(eq(appSettings.key, 'wa.templates'));
  assert.deepEqual(
    Object.keys(stored.value as object),
    ['question_new'],
    'teks kosong tidak disimpan'
  );
  const bad = await settingsRepo.saveSettings(adm.id, {
    ...again,
    waTemplates: { booking_new: 'tanpa tautan {code}' }
  });
  assert.ok(!bad.ok);
  const env = settingsRepo.getEnvStatus();
  assert.equal(env.waEnv.length, 4);
  assert.ok(
    !JSON.stringify(env).includes(process.env.WA_ACCESS_TOKEN || '¤'),
    'nilai env tidak bocor'
  );
  ok('pengaturan: simpan/baca, template salah ditolak, status env tanpa nilai');
} catch (e) {
  failed = true;
  console.error('GAGAL', e);
} finally {
  const ids = (
    await db
      .select({ id: listings.id })
      .from(listings)
      .where(like(listings.slug, `${TAG}-%`))
  ).map((r) => r.id);
  if (ids.length) {
    await db.delete(bookings).where(inArray(bookings.listingId, ids));
    await db.delete(listings).where(inArray(listings.id, ids));
  }
  await db.delete(doors).where(like(doors.slug, `${TAG}-%`));
  for (const d of doorsBefore)
    await db.update(doors).set({ sortOrder: d.sortOrder }).where(eq(doors.id, d.id));
  await db.delete(appSettings).where(inArray(appSettings.key, KEYS));
  if (settingsBefore.length) await db.insert(appSettings).values(settingsBefore);
}
console.log(failed ? '\nadmin.check: GAGAL' : '\nadmin.check: OK');
process.exit(failed ? 1 : 0);
