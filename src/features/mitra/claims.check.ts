// Pemeriksaan klaim usaha (PRD 8.12 langkah 1 dan 4) terhadap DATABASE SUNGGUHAN (kamanga_v2): membuat akun
// …@test.invalid dan listing test-klaim-…, lalu menghapusnya. WA tidak dikirim: notify.sendWa diganti tiruan
// yang menangkap kode OTP.
// Jalankan: bun run src/features/mitra/claims.check.ts
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { listingClaims, listings, user, waOtps } from '@/db/schema';
import { notify } from '@/lib/engines/contracts';
import * as claims from './api/claims';
import { ownedListings } from './api/repository';

// ───── murni ─────
assert.equal(claims.maskWa('6281200077701'), '0812•••••701');
assert.equal(claims.maskWa(null), null);
console.log('1. murni: lulus');

// ───── database ─────
const codes: string[] = [];
notify.sendWa = (async (template, to, params) => {
  if (template === 'otp') codes.push((params as { code: string }).code);
  return {
    mode: 'fallback',
    status: 'link',
    messageId: 0,
    link: `https://wa.me/${to.phone}`,
    text: ''
  };
}) as typeof notify.sendWa;

const tag = `test-klaim-${Date.now().toString(36)}`;
const [vendorA, vendorB, admin] = [randomUUID(), randomUUID(), randomUUID()];
const wa = `62812${randomInt(1_000_000, 9_999_999)}`;
const ids: number[] = [];
const ok = <T extends { ok: boolean }>(r: T, what: string) => {
  assert.ok(r.ok, `${what}: ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};
const no = (r: { ok: boolean }, what: string) =>
  assert.equal(r.ok, false, `${what} seharusnya ditolak`);
const ownerOf = async (id: number) =>
  (await db.select({ o: listings.ownerId }).from(listings).where(eq(listings.id, id)))[0].o;
const statusOf = async (id: number) =>
  (
    await db.select({ s: listingClaims.status }).from(listingClaims).where(eq(listingClaims.id, id))
  )[0].s;

let failed = false;
try {
  await db.insert(user).values(
    [
      [vendorA, 'vendor'],
      [vendorB, 'vendor'],
      [admin, 'admin']
    ].map(([id, role], i) => ({
      id,
      name: `Uji Klaim ${i}`,
      email: `klaim-${id}@test.invalid`,
      role
    }))
  );
  const mk = async (suffix: string, v: Partial<typeof listings.$inferInsert> = {}) => {
    const [l] = await db
      .insert(listings)
      .values({
        slug: `${tag}-${suffix}`,
        name: `[UJI] Klaim ${tag} ${suffix}`,
        status: 'published',
        ...v
      })
      .returning({ id: listings.id });
    ids.push(l.id);
    return l.id;
  };
  const withWa = await mk('wa', { whatsapp: wa });
  const noWa = await mk('tanpa-wa');
  const owned = await mk('milik-b', { ownerId: vendorB, whatsapp: wa });
  const draft = await mk('draf', { status: 'draft' });
  const place = await mk('tempat', { kind: 'place' });

  // Cari: hanya usaha terbit tanpa pemilik; nomor disamarkan.
  const found = await claims.searchClaimable(tag);
  assert.deepEqual(found.map((l) => l.id).toSorted(), [withWa, noWa].toSorted());
  assert.equal(found.find((l) => l.id === withWa)?.waMasked, claims.maskWa(wa));
  assert.deepEqual(await claims.searchClaimable('x'), [], 'kata terlalu pendek');
  no(await claims.requestClaimCode(vendorA, owned, null), 'klaim usaha yang sudah punya pemilik');
  no(await claims.requestClaimCode(vendorA, draft, null), 'klaim draf tim');
  no(await claims.requestClaimCode(vendorA, place, null), 'klaim Tempat (informasi saja)');

  // Dua mitra mengklaim usaha yang sama; kode terbaru yang berlaku.
  const claimB = ok(await claims.requestClaimCode(vendorB, withWa, null), 'klaim B').claimId;
  const r = ok(await claims.requestClaimCode(vendorA, withWa, null), 'klaim A');
  assert.equal(r.code, 'sent');
  const claimA = r.claimId;
  const codeA = codes.at(-1)!;
  assert.equal(codes.length, 2);
  // Kirim ulang memakai klaim yang sama, bukan baris baru.
  assert.equal(
    ok(await claims.requestClaimCode(vendorA, withWa, null), 'kirim ulang').claimId,
    claimA
  );
  const latest = codes.at(-1)!;
  no(await claims.verifyClaimCode(vendorB, claimA, latest), 'B memakai klaim A');
  const wrong = latest.slice(0, 5) + ((Number(latest[5]) + 1) % 10);
  no(await claims.verifyClaimCode(vendorA, claimA, wrong), 'kode salah');
  no(await claims.verifyClaimCode(vendorA, claimA, codeA === latest ? 'abc' : codeA), 'kode lama');
  assert.equal(await ownerOf(withWa), null);
  ok(await claims.verifyClaimCode(vendorA, claimA, latest), 'kode benar');
  assert.equal(await ownerOf(withWa), vendorA);
  assert.equal(await statusOf(claimA), 'approved');
  assert.equal(await statusOf(claimB), 'rejected', 'klaim lain untuk usaha itu ditolak');
  assert.ok(
    (await ownedListings(vendorA)).some((l) => l.id === withWa),
    'muncul di /mitra'
  );
  no(await claims.verifyClaimCode(vendorA, claimA, latest), 'kode sekali pakai');
  no(await claims.requestClaimCode(vendorB, withWa, null), 'klaim setelah ada pemilik');
  assert.deepEqual(await claims.searchClaimable(tag).then((x) => x.map((l) => l.id)), [noWa]);

  // Pemilik dijamin di UPDATE: klaim menunggu untuk usaha yang sudah dimiliki tidak bisa menang.
  const [stale] = await db
    .insert(listingClaims)
    .values({ listingId: withWa, claimantId: vendorB })
    .returning({ id: listingClaims.id });
  no(await claims.approveClaim(stale.id, admin, 'uji'), 'menimpa pemilik');
  assert.equal(await ownerOf(withWa), vendorA);
  await db.delete(listingClaims).where(eq(listingClaims.id, stale.id));

  // Usaha tanpa WA: klaim menunggu tim, lalu tim menolak / menyetujui.
  const n = ok(await claims.requestClaimCode(vendorA, noWa, null), 'klaim tanpa WA');
  assert.equal(n.code, 'none');
  no(await claims.verifyClaimCode(vendorA, n.claimId, '123456'), 'kode untuk usaha tanpa WA');
  assert.ok(
    (await claims.pendingClaims(500)).some((c) => c.id === n.claimId),
    'masuk antrean tim'
  );
  ok(await claims.rejectClaim(n.claimId, admin), 'tim menolak');
  no(await claims.rejectClaim(n.claimId, admin), 'menolak dua kali');
  no(await claims.approveClaim(n.claimId, admin, 'uji'), 'menyetujui klaim yang ditolak');
  const n2 = ok(await claims.requestClaimCode(vendorB, noWa, null), 'klaim B tanpa WA').claimId;
  ok(await claims.approveClaim(n2, admin, 'Diverifikasi tim Kamanga'), 'tim menyetujui');
  assert.equal(await ownerOf(noWa), vendorB);
  const [done] = await db.select().from(listingClaims).where(eq(listingClaims.id, n2));
  assert.deepEqual([done.reviewedBy, done.status], [admin, 'approved']);
  assert.equal((await claims.myClaims(vendorA)).length, 2);

  // Batas klaim menunggu per mitra.
  const extra = await Promise.all(
    Array.from({ length: claims.MAX_PENDING_CLAIMS + 1 }, (_, i) => mk(`batas-${i}`))
  );
  for (const id of extra.slice(0, -1))
    ok(await claims.requestClaimCode(vendorA, id, null), 'klaim');
  no(await claims.requestClaimCode(vendorA, extra.at(-1)!, null), 'melewati batas klaim menunggu');
  console.log('2. database: lulus');
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  if (ids.length) await db.delete(listings).where(inArray(listings.id, ids)); // klaim ikut terhapus
  await db.delete(user).where(inArray(user.id, [vendorA, vendorB, admin]));
  await db.delete(waOtps).where(eq(waOtps.phone, wa));
  await db.$client.end();
}
if (failed) process.exit(1);
console.log('claims.check: semua lulus');
