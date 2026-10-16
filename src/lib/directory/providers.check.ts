// Pemeriksaan findProviders dengan mesin asli dan data dummy tahap 1 (hanya membaca).
// Prasyarat: db:seed-reference, wilayah:import-padang, db:seed-dummy. Jalankan: bun run check:providers
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { location } from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { findProviders } from './providers';

const one = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as T;
const catId = async (slug: string) =>
  (await one<{ id: number }>(sql`select id from categories where slug = ${slug}`)).id;
const place = async (slug: string) =>
  one<{ id: number; lat: number; lng: number }>(
    sql`select id, lat, lng from locations where slug = ${slug}`
  );

const tomorrow = addDays(jakartaDate(new Date()), 1);
const lubeg = await place('lubuk-begalung');
const kuranji = await place('kuranji');

// 1. Kasus PRD 8.2: padel nanti malam dekat Lubuk Begalung, 4 orang. Urut terdekat (PRD 9.1, 8.15).
const evening = { from: fromJakarta(tomorrow, '18:00'), to: fromJakarta(tomorrow, '23:00') };
const padel = await findProviders({
  categoryIds: [await catId('padel-court')],
  origin: { lat: lubeg.lat, lng: lubeg.lng },
  when: evening,
  seats: 4,
  sort: 'distance'
});
assert.ok(padel.items.length > 0, 'ada padel kosong');
for (const c of padel.items) {
  assert.ok(c.slots.length > 0 && c.slots.every((s) => s.state === 'free'));
  assert.ok(c.slots.every((s) => s.startsAt >= evening.from && s.startsAt < evening.to));
  assert.equal(c.mode, 'visit');
  assert.ok(c.distanceLabel);
}
const dists = padel.items.map((c) => c.distanceKm ?? 0);
assert.deepEqual(
  dists,
  dists.toSorted((a, b) => a - b),
  'berurutan dari yang terdekat'
);
console.log(
  '1. padel besok malam dekat Lubeg:',
  padel.items.map((c) => `${c.name} (${c.distanceLabel}, ${c.slots.length} slot)`).join('; ')
);

// 2. Ka servis AC ke alamat di Kuranji: hanya teknisi yang area layanannya mencakup titik itu.
const point = { lat: kuranji.lat, lng: kuranji.lng };
const ac = await findProviders({
  categoryIds: [await catId('ac-repair')],
  origin: point,
  prefer: 'call'
});
for (const c of ac.items) {
  assert.equal(c.mode, 'call');
  assert.ok(await location.isInServiceArea(c.id, point), `${c.slug} melayani Kuranji`);
}
const allAc = (
  await db.execute(sql`
    select l.id from listings l join listing_categories lc on lc.listing_id = l.id
    join categories c on c.id = lc.category_id
    where c.slug = 'ac-repair' and l.status = 'published' and 'on_call' = any(l.service_modes)
      and l.kind = 'provider'`)
).rows as { id: number }[];
let outside = 0;
for (const r of allAc) if (!(await location.isInServiceArea(Number(r.id), point))) outside++;
assert.equal(ac.items.length + ac.uncertain.length, allAc.length - outside);
console.log(`2. servis AC ke Kuranji: ${ac.items.length} melayani, ${outside} di luar area`);

// 3. Travel Padang → Bukittinggi besok pagi, 2 kursi, dijemput di Padang Barat.
const pb = await place('padang-barat');
const travel = await findProviders({
  categoryIds: [await catId('intercity-travel')],
  origin: { lat: pb.lat, lng: pb.lng },
  route: { fromId: pb.id, toId: (await place('bukittinggi')).id },
  when: { from: fromJakarta(tomorrow, '05:00'), to: fromJakarta(tomorrow, '12:00') },
  seats: 2
});
assert.ok(travel.items.length > 0, 'ada travel ke Bukittinggi');
assert.ok(travel.items.every((c) => c.slots.every((s) => s.seatsLeft >= 2)));
console.log(
  '3. travel besok pagi ke Bukittinggi:',
  travel.items.map((c) => `${c.name} (${c.slots.length} keberangkatan)`).join('; ')
);

// 4. Anggaran mustahil: kosong, pelonggaran ditawarkan dengan jumlahnya, tidak diterapkan diam-diam.
const cheap = await findProviders({
  categoryIds: [await catId('padel-court')],
  origin: { lat: lubeg.lat, lng: lubeg.lng },
  when: evening,
  budgetMax: 1000
});
assert.equal(cheap.items.length, 0);
const budget = cheap.relaxations.find((r) => r.key === 'budget');
assert.ok(budget && budget.count > 0, 'tawarkan abaikan anggaran');
console.log(
  '4. anggaran Rp1.000:',
  cheap.relaxations.map((r) => `${r.label} (${r.count})`).join('; ')
);

// 5. Isian aturan sebagai syarat wajib: padel yang termasuk raket ⊆ semua padel.
const racket = await findProviders({
  categoryIds: [await catId('padel-court')],
  attributes: { racket_included: true }
});
const allPadel = await findProviders({ categoryIds: [await catId('padel-court')] });
assert.ok(racket.items.length <= allPadel.items.length);
console.log(`5. padel termasuk raket: ${racket.items.length} dari ${allPadel.items.length}`);

// 6. Tempat (apotek 24 jam): ikut hanya bila providersOnly false, dan tidak bisa dipesan.
const apotek = await findProviders({
  categoryIds: [await catId('pharmacy-24h')],
  origin: point,
  providersOnly: false
});
assert.ok(apotek.items.length > 0 && apotek.items.every((c) => c.kind === 'place' && !c.bookable));
assert.equal(
  (await findProviders({ categoryIds: [await catId('pharmacy-24h')], origin: point })).items.length,
  0
);
console.log(`6. apotek 24 jam: ${apotek.items.length} tempat, tidak bisa dipesan`);

// 7. Penyedia "belum" verifikasi tampil tetapi tidak bisa dipesan.
const all = await findProviders({
  categoryIds: [await catId('padel-court'), await catId('barbershop'), await catId('ac-repair')],
  limit: 30
});
for (const c of all.items) assert.equal(c.bookable, c.verification !== 'unverified');
console.log('7. bookable mengikuti verifikasi');

assert.ok(dists.length > 0);
console.log('providers.check: OK');
process.exit(0);
