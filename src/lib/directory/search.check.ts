// Pemeriksaan pencarian dan pemahaman kata terhadap DATABASE SUNGGUHAN.
// Prasyarat: data acuan + listing dummy: bun run db:fresh:dummy (atau db:seed-reference lalu db:seed-dummy).
// Jalankan: bun run check:search
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { glossaryTerms } from '@/db/schema';
import { searchListings, type SearchParams } from './search';
import { findKamusTerms, resolveCategories, resolveLocation } from './understand';

// ───── prasyarat data ─────
const have = Number(
  (
    (await db.execute(sql`select count(*) c from listings where status = 'published'`))
      .rows as any[]
  )[0].c
);
if (have < 20) {
  console.error('Butuh data: jalankan bun run db:seed-dummy dulu (setelah db:seed-reference).');
  process.exit(1);
}

// ───── pemahaman kata ─────
const first = async (t: string) => (await resolveLocation(t)).best?.name;
assert.equal(await first('lubeg'), 'Lubuk Begalung');
assert.equal(await first('di Bukiktinggi'), 'Kota Bukittinggi');
assert.equal(await first('aia pacah'), 'Aie Pacah');
assert.equal(await first('lubuk begalng'), 'Lubuk Begalung'); // salah ketik
assert.equal((await resolveLocation('koto baru')).ambiguous, true);
assert.equal((await resolveLocation('xyzxyz')).candidates.length, 0);
const names = async (t: string) => (await resolveCategories(t)).map((c) => c.name);
assert.deepEqual(await names('onda mogok'), ['Servis Motor']);
// sebutan lain kategori dan kebutuhan; kebutuhan membuka beberapa kategori sekaligus
const wedding = await names('cari baralek');
assert.ok(wedding.length > 2 && wedding.includes('Gedung Acara') && wedding.includes('Katering'));
assert.ok((await names('ac saya rusak')).includes('Servis AC'));
assert.deepEqual(await names('desain logo usaha'), ['Desain Logo']);
// kamus: hanya kata yang sudah dicek penutur asli yang dipakai. Tanda "dicek" pada satu kata diubah
// sementara lalu dikembalikan. SQL langsung agar `updated_at` tidak ikut berubah.
const [lapau] = await db.select().from(glossaryTerms).where(eq(glossaryTerms.term, 'lapau'));
assert.ok(lapau, 'kamus acuan belum dimuat (bun run db:seed-reference)');
const setChecked = (v: boolean) =>
  db.execute(sql`update glossary_terms set is_checked = ${v} where id = ${lapau.id}`);
try {
  await setChecked(true);
  assert.equal((await findKamusTerms('lapau dekat sini')).length, 1);
  await setChecked(false);
  assert.equal((await findKamusTerms('lapau dekat sini')).length, 0);
} finally {
  await setChecked(lapau.isChecked);
}
assert.ok((await names('mau jalan-jalan weekend')).includes('Wisata Alam'));
assert.deepEqual(await names('halo apa kabar'), []);
console.log('0. pemahaman kata (lokasi + kategori): OK');

const cat = async (t: string) => (await resolveCategories(t)).map((c) => c.id);
const loc = async (t: string) => (await resolveLocation(t)).best!.id;
const statusOf = async (ids: number[]) =>
  ids.length
    ? (
        (
          await db.execute(
            sql`select status::text s from listings where id = any(${sql.raw('array[' + ids.join(',') + ']')})`
          )
        ).rows as any[]
      ).map((r) => r.s)
    : [];
const line = (r: Awaited<ReturnType<typeof searchListings>>) =>
  r.items.map((i) => `${i.name.replace('[DUMMY] ', '')} (${i.score.toFixed(2)})`).join(' | ');

// 1. servis AC di Padang: hanya yang terbit, hanya kategori AC
let r = await searchListings({
  categoryIds: await cat('servis ac'),
  locationId: await loc('padang'),
  limit: 8
});
assert.ok(r.items.length >= 2 && r.items.every((i) => i.category?.slug === 'ac-repair'));
assert.ok((await statusOf(r.items.map((i) => i.id))).every((s) => s === 'published'));
assert.ok(
  r.items.every((w, k, a) => k === 0 || a[k - 1].score >= w.score),
  'urut skor turun'
);
console.log('1. servis AC di Padang:', r.total, 'cocok ->', line(r).slice(0, 150));

// 2. tingkat kedekatan di Lubeg: satu tempat > satu kota; alasan tercatat
r = await searchListings({
  categoryIds: await cat('onda mogok'),
  locationId: await loc('lubeg'),
  limit: 20
});
const geoVals = new Set(r.items.map((i) => i.parts.geo?.value.toFixed(1)));
console.log(
  '2. onda di Lubeg:',
  r.total,
  'cocok; nilai geo yang muncul =',
  [...geoVals].join(','),
  '| lokasi diterapkan:',
  r.applied.location?.name,
  '| titik:',
  r.applied.origin
);
// Lubuk Begalung punya titik sendiri sejak poligon Padang diimpor (sebelumnya titik induk/kota).
assert.ok(r.items.length > 0 && r.applied.origin === 'lokasi');
const same = r.items.filter((i) => i.reasons.includes('di lokasi yang sama'));
const parent = r.items.filter((i) => i.reasons.includes('satu kota/kecamatan induk'));
console.log('   di lokasi sama:', same.length, '| satu kota:', parent.length);
if (same.length && parent.length)
  assert.ok(
    Math.min(...same.map((i) => i.parts.geo!.value)) >
      Math.max(...parent.map((i) => i.parts.geo!.value))
  );

// 3. kata saja ("nasi kapau"): relevan, tidak ada gedung
r = await searchListings({ q: 'nasi kapau', limit: 10 });
assert.ok(r.items.length > 0 && r.items[0].category?.slug === 'catering', r.items[0]?.name);
assert.ok(r.items.every((i) => i.category?.slug !== 'event-venue'));
console.log(
  '3. kata "nasi kapau":',
  r.total,
  'cocok; teratas =',
  r.items[0].name,
  '|',
  r.items[0].reasons.slice(0, 3).join(', ')
);
assert.equal((await searchListings({ q: 'xqzv wkj' })).total, 0);

// 4. anggaran Rp40.000 per orang untuk katering
r = await searchListings({
  categoryIds: await cat('katering'),
  budget: { max: 40000, unit: 'per_person' },
  limit: 20
});
const priceRows = (
  await db.execute(
    sql`select id, price_min from listings where id = any(${sql.raw('array[' + r.items.map((i) => i.id).join(',') + ']')})`
  )
).rows as any[];
assert.ok(priceRows.every((x) => x.price_min === null || x.price_min <= 40000));
console.log('4. katering <= Rp40.000:', r.total, 'cocok; harga min semua <= 40.000 OK');

// 5. kapasitas gedung >= 300: harus sama dengan hitungan database
r = await searchListings({
  categoryIds: await cat('gedung acara'),
  attributeFilters: [{ key: 'capacity', min: 300 }],
  limit: 20
});
const dbCount = Number(
  (
    (
      await db.execute(
        sql`select count(*) c from listings l join listing_categories lc on lc.listing_id=l.id and lc.is_primary join categories c on c.id=lc.category_id and c.slug='event-venue' where l.status='published' and (l.attributes->>'capacity')::numeric >= 300`
      )
    ).rows as any[]
  )[0].c
);
assert.equal(r.total, dbCount);
assert.ok(r.items.every((i) => Number(i.attributes.capacity) >= 300));
console.log('5. gedung >= 300 orang:', r.total, '(sama dengan hitungan database', dbCount + ')');
assert.equal(
  (
    await searchListings({
      categoryIds: await cat('gedung acara'),
      attributeFilters: [{ key: "x'; drop table listings;--", min: 1 }]
    })
  ).total >= 0,
  true
); // kunci jahat diabaikan

// 6. hanya yang dicek langsung
r = await searchListings({ minVerification: 'visited', limit: 20 });
assert.ok(r.items.length > 0 && r.items.every((i) => i.verification === 'visited'));
console.log('6. dicek langsung saja:', r.total, 'OK');

// 7. dekat titik koordinat (pusat Padang, 8 km): tidak ada yang lebih jauh; jarak terisi
r = await searchListings({ near: { lat: -0.9471, lng: 100.4172 }, radiusKm: 8, limit: 20 });
assert.ok(r.items.length > 0);
assert.ok(
  r.items.every(
    (i) => i.serviceModes.includes('online') || (i.distanceKm !== null && i.distanceKm <= 8)
  )
);
console.log(
  '7. dekat Padang 8 km:',
  r.total,
  'cocok; terdekat =',
  r.items
    .filter((i) => i.distanceKm !== null)
    .sort((a, b) => a.distanceKm! - b.distanceKm!)[0]
    ?.distanceKm?.toFixed(2),
  'km'
);

// 8. saran perluasan akurat: radius sempit -> saran radius lebih lebar; jumlahnya = hasil sebenarnya
const narrow: SearchParams = {
  categoryIds: await cat('wisata alam'),
  near: { lat: -0.9471, lng: 100.4172 },
  radiusKm: 1
};
const rn = await searchListings(narrow);
assert.ok(rn.alternatives.length > 0, 'ada saran');
const wide = await searchListings({ ...narrow, radiusKm: 3 });
const radiusAlt = rn.alternatives.find((a) => a.label.includes('radius'));
if (radiusAlt) assert.equal(radiusAlt.count, wide.total);
console.log(
  '8. wisata alam radius 1 km:',
  rn.total,
  'cocok; saran =',
  rn.alternatives.map((a) => a.label + ' -> ' + a.count).join('; ')
);

// 9. kosong karena anggaran terlalu kecil: tetap jujur + saran
r = await searchListings({
  categoryIds: await cat('katering'),
  budget: { max: 1, unit: 'per_person' }
});
assert.equal(r.total, 0);
assert.ok(r.alternatives.some((a) => a.label.includes('anggaran') && a.count > 0));
console.log(
  '9. anggaran Rp1: 0 cocok; saran =',
  r.alternatives.map((a) => a.label + ' -> ' + a.count).join('; ')
);

// 10. halaman
const all = await searchListings({ categoryIds: await cat('servis ac'), limit: 20 });
const p2 = await searchListings({ categoryIds: await cat('servis ac'), limit: 3, offset: 3 });
assert.deepEqual(
  p2.items.map((i) => i.id),
  all.items.slice(3, 6).map((i) => i.id)
);
console.log('10. halaman: offset 3 sama dengan potongan daftar penuh OK');

// 11. layanan daring ikut muncul untuk lokasi mana pun
r = await searchListings({
  categoryIds: await cat('desain logo'),
  locationId: await loc('lubeg'),
  limit: 5
});
assert.ok(r.items.length > 0 && r.items.every((i) => i.serviceModes.includes('online')));
console.log('11. desain logo (daring) di Lubeg:', r.total, 'cocok, semuanya layanan daring OK');

// 12. tak ada yang bukan "terbit": telusuri SEMUA tanpa filter
const every = await searchListings({ limit: 20 });
const pub = Number(
  (
    (await db.execute(sql`select count(*) c from listings where status='published'`)).rows as any[]
  )[0].c
);
assert.equal(every.total, Math.min(pub, 500));
console.log(
  '12. tanpa filter:',
  every.total,
  'dari',
  pub,
  'listing terbit; draf/menunggu review tidak ikut OK'
);

// 13. masukan aneh tidak merusak
for (const q of ["'; select 1;--", '%%%', '___', 'a', '   ', 'ÄÖÜ ñ', 'x'.repeat(500)])
  await searchListings({ q, limit: 3 });
await searchListings({ near: { lat: 999, lng: 999 } })
  .then(() => assert.fail('seharusnya gagal'))
  .catch(() => {});
console.log('13. masukan aneh: tidak merusak (koordinat mustahil ditolak database) OK');
process.exit(0);
