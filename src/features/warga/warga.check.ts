// Pemeriksaan logika halaman warga. Jalankan: bun run src/features/warga/warga.check.ts
// Bagian 2 menulis ke database (akun ...@test.invalid, listing test-warga-...) dan menghapusnya di finally.
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/auth-schema';
import {
  bookingContacts,
  bookings,
  categories,
  listings,
  reviews,
  savedAddresses,
  waMessages,
  waOtps
} from '@/db/schema';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import { deleteCitizenData } from './api/repository';
import { buildRules, maskPhone, periodWindow, rulesLines, safeNext } from './lib/format';

// ───── 1. fungsi murni ─────
assert.equal(safeNext('/pesan/x?unit=1'), '/pesan/x?unit=1');
for (const bad of [
  null,
  '',
  'https://jahat.example',
  '//jahat.example',
  '/\\jahat.example',
  'pesan'
])
  assert.equal(safeNext(bad), '/', `tolak ${bad}`);
assert.equal(maskPhone('6281234567890'), '0812 •••• 7890');

const padel = parseAttributeSchema([
  { key: 'min_duration', type: 'duration', label: 'Durasi minimal' },
  { key: 'racket_included', type: 'boolean', label: 'Termasuk raket' },
  { key: 'racket_price', type: 'rupiah', label: 'Harga sewa raket' },
  { key: 'cancel_before', type: 'duration', label: 'Batas pembatalan' },
  { key: 'dp_required', type: 'boolean', label: 'Wajib DP' },
  { key: 'facilities', type: 'multiselect', label: 'Fasilitas', options: ['Musala'] }
]);
const r = buildRules(padel, {
  min_duration: 60,
  racket_included: false,
  racket_price: 25000,
  cancel_before: 1440,
  dp_required: true,
  facilities: ['Musala'],
  bukan_isian: 5
});
assert.deepEqual(r.snapshot, {
  minMinutes: 60,
  cancelBeforeMinutes: 1440,
  dpRequired: true,
  notes: ['Termasuk raket: Tidak', 'Harga sewa raket: Rp25.000']
});
assert.deepEqual(r.lines, [
  'Durasi minimal 1 jam',
  'Pembatalan paling lambat 1 hari sebelum jadwal',
  'Wajib bayar DP (uang muka) langsung ke penyedia',
  'Termasuk raket: Tidak',
  'Harga sewa raket: Rp25.000'
]);
assert.deepEqual(rulesLines(r.snapshot), r.lines, 'teks aturan sama dari snapshot');
// Nilai tanpa definisi di skema kategori tidak dipakai; cancel_before 0 = bebas batal.
assert.deepEqual(buildRules([], { cancel_before: 60 }).snapshot, {});
assert.deepEqual(
  buildRules(parseAttributeSchema([{ key: 'cancel_before', type: 'duration', label: 'x' }]), {
    cancel_before: 0
  }).lines,
  ['Bisa dibatalkan kapan saja sebelum jadwal']
);

const malam = periodWindow('2026-10-18', 'malam');
assert.equal(malam.from.toISOString(), '2026-10-18T11:00:00.000Z');
assert.equal(malam.to.toISOString(), '2026-10-18T17:00:00.000Z');
const sehari = periodWindow('2026-10-18', 'semua');
assert.equal(sehari.to.getTime() - sehari.from.getTime(), 86_400_000);
console.log('1. fungsi murni: lulus');

// ───── 2. hapus akun warga (PRD 8.7, UU PDP) ─────
const uid = `test-warga-${Date.now()}`;
const vid = `${uid}-mitra`;
const phone = `62899${String(Date.now()).slice(-8)}`;
let listingId: number | null = null;
let waIds: number[] = [];
try {
  const [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, 'padel-court'));
  await db.insert(user).values([
    {
      id: uid,
      name: 'Uji Warga',
      email: `${uid}@test.invalid`,
      role: 'citizen',
      phoneNumber: phone,
      privacyConsentAt: new Date()
    },
    { id: vid, name: 'Uji Mitra', email: `${vid}@test.invalid`, role: 'vendor' }
  ]);
  [{ id: listingId }] = await db
    .insert(listings)
    .values({ slug: `test-warga-hapus-${Date.now()}`, name: 'Uji Hapus Akun', status: 'draft' })
    .returning({ id: listings.id });
  const [b] = await db
    .insert(bookings)
    .values({
      code: `TW${String(Date.now()).slice(-6)}`,
      citizenId: uid,
      listingId,
      categoryId: cat.id,
      status: 'completed'
    })
    .returning({ id: bookings.id });
  await db
    .insert(bookingContacts)
    .values({ bookingId: b.id, name: 'Uji', phone, address: 'Jl. Uji 1' });
  await db.insert(reviews).values({ bookingId: b.id, listingId, citizenId: uid, satisfied: true });
  await db.insert(savedAddresses).values({ userId: uid, label: 'Rumah', address: 'Jl. Uji 1' });
  await db
    .insert(waOtps)
    .values({ phone, codeHash: 'x', expiresAt: new Date(Date.now() + 60_000) });
  waIds = (
    await db
      .insert(waMessages)
      .values([
        { direction: 'outbound', template: 'otp', phone, mode: 'fallback' },
        {
          direction: 'outbound',
          template: 'review_request',
          phone,
          mode: 'fallback',
          bookingId: b.id
        }
      ])
      .returning({ id: waMessages.id })
  ).map((w) => w.id);

  await assert.rejects(
    deleteCitizenData(vid),
    'akun non-warga tidak boleh dihapus lewat jalur ini'
  );
  await deleteCitizenData(uid);

  assert.equal((await db.select().from(user).where(eq(user.id, uid))).length, 0, 'user terhapus');
  assert.equal(
    (await db.select().from(savedAddresses).where(eq(savedAddresses.userId, uid))).length,
    0,
    'alamat tersimpan terhapus'
  );
  assert.equal(
    (await db.select().from(bookingContacts).where(eq(bookingContacts.bookingId, b.id))).length,
    0,
    'kontak pesanan terhapus'
  );
  const [kept] = await db.select().from(bookings).where(eq(bookings.id, b.id));
  assert.ok(kept && kept.citizenId === null, 'pesanan tetap ada tanpa identitas');
  const [rev] = await db.select().from(reviews).where(eq(reviews.bookingId, b.id));
  assert.ok(rev && rev.citizenId === null, 'ulasan tetap ada tanpa identitas');
  assert.equal(
    (await db.select().from(waOtps).where(eq(waOtps.phone, phone))).length,
    0,
    'OTP terhapus'
  );
  assert.equal(
    (await db.select().from(waMessages).where(eq(waMessages.phone, phone))).length,
    0,
    'nomor di log WA terhapus'
  );
  console.log('2. hapus akun warga: lulus');
} finally {
  if (listingId) await db.delete(listings).where(eq(listings.id, listingId));
  if (waIds.length) await db.delete(waMessages).where(inArray(waMessages.id, waIds));
  await db.delete(waOtps).where(eq(waOtps.phone, phone));
  await db.delete(user).where(inArray(user.id, [uid, vid]));
}
process.exit(0);
