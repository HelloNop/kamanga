// Pemeriksaan Mesin Lokasi terhadap DATABASE SUNGGUHAN (kamanga_v2).
// Prasyarat: data acuan + poligon Padang (bun run scripts/wilayah/import-padang.ts); bagian akhir memakai listing
// dummy bila ada (bun run db:seed-dummy).
// Jalankan: bun run src/lib/engines/location/location.check.ts
//
// Semua panggilan mesin berjalan di koneksi BACA-SAJA: bila mesin mencoba menyimpan apa pun (mis. koordinat
// warga, UU PDP), database menolaknya dan uji gagal. Data uji ditulis lewat koneksi terpisah (slug test-lokasi-…)
// dan dihapus di akhir.
import assert from 'node:assert/strict';
import { like, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { db } from '@/db';
import { listingAreas, listingCategories, listings, searchLogs } from '@/db/schema';
import { location } from '@/lib/engines/contracts';
import type { PlaceContext, Point } from '@/lib/engines/contracts';

// Koneksi mesin dibuat baca-saja SEBELUM query pertama (parameter awal koneksi Postgres).
(db.$client as Pool).options.options = '-c default_transaction_read_only=on';
const writerPool = new Pool({ connectionString: process.env.DATABASE_URL });
const w = drizzle(writerPool, { casing: 'snake_case' });

type Row = Record<string, unknown>;
const one = async (q: ReturnType<typeof sql>) => (await w.execute(q)).rows[0] as Row | undefined;
const idOf = async (slug: string, table: 'locations' | 'categories') =>
  Number((await one(sql`select id from ${sql.raw(table)} where slug = ${slug}`))?.id);

// Titik uji (dicek terhadap poligon: semuanya > 250 m dari batas kecamatan).
const KURANJI: Point = { lat: -0.8848, lng: 100.4326 }; // kelurahan Kuranji, Kec. Kuranji
const PURUS: Point = { lat: -0.9368, lng: 100.3527 }; // Kec. Padang Barat
const BUNGUS: Point = { lat: -1.008, lng: 100.446 }; // Kec. Bungus Teluk Kabung
const NANGGALO: Point = { lat: -0.897, lng: 100.3701 }; // kelurahan Surau Gadang, Kec. Nanggalo
const LAUT: Point = { lat: -0.95, lng: 100.3 }; // Samudra Hindia, barat Padang
const BUKITTINGGI: Point = { lat: -0.3055, lng: 100.3692 }; // di luar poligon mana pun
const shift = (p: Point, dLat: number): Point => ({ lat: p.lat + dLat, lng: p.lng });

const SLUG = 'test-lokasi-';
const cleanup = async () => {
  await w.delete(listings).where(like(listings.slug, `${SLUG}%`));
  await w.delete(searchLogs).where(sql`${searchLogs.query} = 'test-lokasi'`);
};
/** "Andaleh" → id wilayah bila terselesaikan, selain itu jenis hasilnya. */
const pick = async (ctx: PlaceContext) => {
  const r = await location.resolvePlaceName('Andaleh', ctx);
  return r.kind === 'resolved' ? r.region.id : r.kind;
};

const padangPolygons = Number(
  (
    await one(
      sql`select count(*) c from locations where boundary is not null and official_code like '13.71%'`
    )
  )?.c
);
if (padangPolygons < 100) {
  console.error(
    'Butuh poligon Padang: jalankan bun run scripts/wilayah/import-padang.ts dulu (setelah db:seed-reference).'
  );
  process.exit(1);
}

await cleanup();
try {
  // ───── 0. pengaman baca-saja aktif ─────
  await assert.rejects(db.execute(sql`delete from search_logs where false`), (e: Error) =>
    /read-only/.test(String(e.cause))
  );
  console.log('0. koneksi mesin baca-saja OK');

  // ───── 1. formatDistance ─────
  const f = location.formatDistance;
  assert.equal(f(0.65), '650 m');
  assert.equal(f(0.62), '600 m');
  assert.equal(f(0.01), '50 m');
  assert.equal(f(0.999), '1,0 km');
  assert.equal(f(1.83), '1,8 km');
  assert.equal(f(9.96), '10 km');
  assert.equal(f(12.4), '12 km');
  console.log('1. formatDistance OK');

  // ───── 2. titik → wilayah ─────
  const padangId = await idOf('padang', 'locations');
  const kuranjiId = await idOf('kuranji', 'locations');
  const nanggaloId = await idOf('nanggalo', 'locations');
  assert.deepEqual(await location.serviceRegionIds(), [padangId]);

  const k = await location.resolvePoint(KURANJI);
  assert.ok(k);
  assert.equal(k.district?.name, 'Kuranji');
  assert.equal(k.district?.id, kuranjiId);
  assert.equal(k.village?.name, 'Kuranji');
  assert.equal(k.city?.id, padangId);
  assert.equal(k.label, 'Kuranji, Padang');
  assert.equal(k.inServiceRegion, true);
  assert.equal((await location.resolvePoint(PURUS))?.district?.name, 'Padang Barat');
  assert.equal((await location.resolvePoint(BUNGUS))?.district?.name, 'Bungus Teluk Kabung');
  assert.equal(await location.resolvePoint(LAUT), null);
  assert.equal(await location.resolvePoint(BUKITTINGGI), null);
  await assert.rejects(location.resolvePoint({ lat: 999, lng: 100 }), RangeError);
  console.log('2. titik di Kuranji terbaca "Kuranji, Padang"; laut dan luar Padang: null OK');

  // ───── 3. nama daerah → wilayah ─────
  const kb = await location.resolvePlaceName('Koto Baru');
  assert.equal(kb.kind, 'resolved', '"Koto Baru" tidak boleh memicu pertanyaan');
  assert.equal(kb.region.name, 'Koto Baru Nan XX');
  assert.equal(kb.region.parentName, 'Lubuk Begalung');
  assert.equal((await location.resolvePoint(kb.region.center!))?.inServiceRegion, true);
  assert.equal((await location.resolvePlaceName('di koto baru')).kind, 'resolved');

  const kur = await location.resolvePlaceName('Kuranji');
  assert.ok(kur.kind === 'resolved' && kur.region.id === kuranjiId); // kecamatan, bukan kelurahan
  const brg = await location.resolvePlaceName('Baringin'); // 3 di Sumbar, 1 di Padang
  assert.ok(brg.kind === 'resolved' && brg.region.parentName === 'Lubuk Kilangan');
  const lubeg = await location.resolvePlaceName('lubeg');
  assert.ok(lubeg.kind === 'resolved' && lubeg.region.name === 'Lubuk Begalung');
  // "Lubuk": banyak di Padang. Ambigu, KECUALI search_logs sudah menunjukkan yang paling sering dicari
  // (isi database sungguhan); aturan pencarian terbanyak diuji terkendali pada kasus Andaleh di bawah.
  const lubuk = await location.resolvePlaceName('Lubuk');
  assert.ok(
    lubuk.kind === 'ambiguous' ||
      (lubuk.kind === 'resolved' && lubuk.region.name.startsWith('Lubuk '))
  );
  assert.equal((await location.resolvePlaceName('xyzxyz')).kind, 'not_found');

  // "Andaleh": dua nagari di luar Padang (Batipuh, Luak). Diselesaikan konteks bila ada.
  const andaleh = (
    await w.execute(sql`
      select v.id, v.parent_id from locations v join locations d on d.id = v.parent_id
      where v.name = 'Andaleh' and d.name in ('Batipuh', 'Luak') order by d.name`)
  ).rows as { id: number; parent_id: number }[];
  assert.equal(andaleh.length, 2);
  const [batipuh, luak] = andaleh;
  assert.equal(await pick({}), 'ambiguous');
  assert.equal(await pick({ lastLocationId: batipuh.parent_id }), batipuh.id);
  assert.equal(await pick({ savedLocationIds: [luak.parent_id] }), luak.id);
  assert.equal(await pick({ lastLocationId: batipuh.id, savedLocationIds: [luak.id] }), batipuh.id);
  await w.insert(searchLogs).values(
    [1, 2].map(() => ({
      source: 'rules',
      status: 'ok',
      query: 'test-lokasi',
      needKey: 'test-lokasi',
      label: 'test-lokasi',
      locationId: luak.id
    }))
  );
  assert.equal(await pick({}), luak.id);
  console.log(
    '3. "Koto Baru" → Koto Baru Nan XX (Padang) tanpa bertanya; konteks dan pencarian terbanyak OK'
  );

  // ───── 4. area layanan ─────
  const barber = await idOf('barbershop', 'categories');
  const ac = await idOf('ac-repair', 'categories');
  const add = async (
    name: string,
    v: Partial<typeof listings.$inferInsert> & { at?: Point | null },
    areas: number[] = [],
    cats: { id: number; primary: boolean }[] = []
  ) => {
    const { at, ...rest } = v;
    const [row] = await w
      .insert(listings)
      .values({
        slug: `${SLUG}${name}`,
        name: `[TEST] ${name}`,
        status: 'published',
        lat: at?.lat ?? null,
        lng: at?.lng ?? null,
        ...rest
      })
      .returning({ id: listings.id });
    if (areas.length)
      await w
        .insert(listingAreas)
        .values(areas.map((locationId) => ({ listingId: row.id, locationId })));
    if (cats.length)
      await w
        .insert(listingCategories)
        .values(cats.map((c) => ({ listingId: row.id, categoryId: c.id, isPrimary: c.primary })));
    return row.id;
  };
  const onCall = { serviceModes: ['on_call' as const] };
  const callArea = await add('call-kuranji', { ...onCall, at: KURANJI }, [kuranjiId]);
  const callRadius = await add('call-radius', { ...onCall, at: PURUS, serviceRadiusKm: 3 });
  const callDefault = await add('call-bawaan', {
    ...onCall,
    at: NANGGALO,
    locationId: nanggaloId
  });
  const callNoPoint = await add('call-tanpa-titik', { ...onCall, locationId: kuranjiId });
  const callCity = await add('call-kota', { ...onCall, at: PURUS }, [padangId]);
  const callDraft = await add('call-draft', { ...onCall, at: KURANJI, status: 'draft' }, [
    padangId
  ]);
  const inArea = location.isInServiceArea;

  assert.equal(await inArea(callArea, KURANJI), true);
  assert.equal(await inArea(callArea, PURUS), false);
  assert.equal(await inArea(callArea, BUNGUS), false);
  assert.equal(await inArea(callRadius, shift(PURUS, 0.01)), true); // ±1,1 km
  assert.equal(await inArea(callRadius, KURANJI), false); // ±10 km
  assert.equal(await inArea(callDefault, shift(NANGGALO, 0.005)), true);
  assert.equal(await inArea(callDefault, KURANJI), false); // ±7 km, kecamatan lain
  assert.equal(await inArea(callNoPoint, KURANJI), true); // bawaan: kecamatannya sendiri
  assert.equal(await inArea(callNoPoint, PURUS), false);
  assert.equal(await inArea(callCity, BUNGUS), true);
  assert.equal(await inArea(callCity, BUKITTINGGI), false);

  const testIds = [callArea, callRadius, callDefault, callNoPoint, callCity, callDraft];
  const ids = async (origin: Point) =>
    (await location.nearestListings({ origin, mode: 'call', listingIds: testIds })).map(
      (r) => r.listingId
    );
  // Teknisi panggilan tidak muncul untuk alamat di luar area layanannya; draft tidak pernah muncul.
  assert.deepEqual(await ids(BUNGUS), [callCity]);
  assert.deepEqual(await ids(KURANJI), [callArea, callCity, callNoPoint]); // urut jarak markas, tanpa titik di akhir
  console.log('4. area layanan (wilayah, kota, radius, bawaan) dan saringan mode panggilan OK');

  // ───── 5. urutan jarak (warga datang) ─────
  const v3 = await add('visit-jauh', { at: shift(KURANJI, 0.05) }, [], [{ id: ac, primary: true }]);
  const v1 = await add(
    'visit-dekat',
    { at: shift(KURANJI, 0.005) },
    [],
    [{ id: barber, primary: true }]
  );
  const v4 = await add('visit-tanpa-titik', {});
  const v2 = await add(
    'visit-sedang',
    { at: shift(KURANJI, -0.02) },
    [],
    [
      { id: ac, primary: true },
      { id: barber, primary: false }
    ]
  );
  const vDraft = await add('visit-draft', { at: KURANJI, status: 'draft' });
  const online = await add('online', { serviceModes: ['online'] });
  const all = [...testIds, v1, v2, v3, v4, vDraft, online];

  const visit = await location.nearestListings({ origin: KURANJI, mode: 'visit', listingIds: all });
  assert.deepEqual(
    visit.map((r) => r.listingId),
    [v1, v2, v3, v4]
  );
  assert.ok(
    visit[0].distanceKm! < visit[1].distanceKm! && visit[1].distanceKm! < visit[2].distanceKm!
  );
  assert.equal(visit[3].distanceKm, null);
  assert.equal(location.formatDistance(visit[0].distanceKm!), '550 m');
  const near3 = await location.nearestListings({
    origin: KURANJI,
    mode: 'visit',
    listingIds: all,
    radiusKm: 3
  });
  assert.deepEqual(
    near3.map((r) => r.listingId),
    [v1, v2]
  );
  const barberOnly = await location.nearestListings({
    origin: KURANJI,
    mode: 'visit',
    listingIds: all,
    categoryIds: [barber]
  });
  assert.deepEqual(
    barberOnly.map((r) => r.listingId),
    [v1, v2] // kategori utama maupun tambahan
  );
  assert.equal(
    (await location.nearestListings({ origin: KURANJI, mode: 'visit', listingIds: all, limit: 1 }))
      .length,
    1
  );
  assert.deepEqual(
    await location.nearestListings({ origin: KURANJI, mode: 'online', listingIds: all }),
    [{ listingId: online, distanceKm: null }]
  );
  console.log('5. warga datang: urut dari yang terdekat, radius, kategori, daring OK');

  // ───── 6. data dummy (bila ada) ─────
  const dummy = (
    await w.execute(sql`
      select slug, id from listings
      where slug in ('dummy-padang-ac-repair-1', 'dummy-padang-ac-repair-3') and status = 'published'`)
  ).rows as { slug: string; id: number }[];
  if (dummy.length === 2) {
    const id = (s: string) => dummy.find((d) => d.slug === s)!.id;
    const call = await location.nearestListings({ origin: KURANJI, mode: 'call' });
    const got = new Set(call.map((r) => r.listingId));
    assert.ok(got.has(id('dummy-padang-ac-repair-1'))); // area: seluruh Padang
    assert.ok(!got.has(id('dummy-padang-ac-repair-3'))); // area: Lubuk Begalung + Padang Barat saja
    for (const r of call) assert.equal(await inArea(r.listingId, KURANJI), true);
    const vis = await location.nearestListings({ origin: KURANJI, mode: 'visit' });
    const km = vis.filter((r) => r.distanceKm != null).map((r) => r.distanceKm!);
    assert.deepEqual(
      km,
      km.toSorted((a, b) => a - b)
    );
    console.log(
      `6. dummy: ${call.length} penyedia panggilan untuk Kuranji, ${vis.length} urut jarak OK`
    );
  } else console.log('6. dummy: dilewati (listing dummy belum dimuat)');

  console.log('Semua pemeriksaan Mesin Lokasi lulus.');
} finally {
  await cleanup();
  await writerPool.end();
}
process.exit(0);
