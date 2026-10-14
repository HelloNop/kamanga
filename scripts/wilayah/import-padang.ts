// Mengimpor poligon batas kecamatan dan kelurahan Kota Padang (kode Kemendagri) ke tabel `locations`.
// Sumber dan lisensi: data/wilayah/README.md. Berkas .sql di sana HANYA dibaca sebagai teks (regex + JSON.parse),
// tidak pernah dijalankan ke database.
//
// Yang diisi: `boundary`, `official_code`, dan `lat`/`lng` (titik di dalam poligon, ST_PointOnSurface) bila masih
// kosong. Baris dicocokkan lewat nama di bawah induknya: kecamatan di bawah slug `padang`, kelurahan di bawah
// kecamatannya. Aman diulang (hasilnya sama).
//
// Jalankan: bun run scripts/wilayah/import-padang.ts
import { readFileSync } from 'node:fs';
import { type SQL, sql } from 'drizzle-orm';
import { db } from '@/db';
import { normSql } from '@/lib/directory/understand';

const CITY = { slug: 'padang', code: '13.71' };
const FILES = ['wilayah_boundaries_kec_13.sql', 'wilayah_boundaries_kel_13.71.sql'];

type Feature = { code: string; name: string; geojson: string };

// Baris data: ('13.71.09.1007','Kuranji',-0.89,100.40,'[[[lat,lng],...]]')
const ROW = /\('([0-9.]+)','((?:[^'\\]|''|\\.)*)',[^,]*,[^,]*,'(\[[^']*\])'\)/g;
const depth = (x: unknown): number => (Array.isArray(x) ? 1 + depth(x[0]) : 0);

/** Isian `path` sumber berurutan [lat, lng], berupa poligon (3 lapis) atau multipoligon (4 lapis).
 *  GeoJSON butuh [lng, lat] dan selalu MultiPolygon di sini. */
function toGeoJson(path: string): string {
  const raw = JSON.parse(path) as unknown;
  const polys = (depth(raw) === 3 ? [raw] : raw) as number[][][][];
  const coordinates = polys.map((poly) =>
    poly.map((ring) =>
      ring.map(([lat, lng]) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('koordinat rusak');
        return [lng, lat];
      })
    )
  );
  return JSON.stringify({ type: 'MultiPolygon', coordinates });
}

const features: Feature[] = [];
for (const f of FILES) {
  const text = readFileSync(new URL(`../../data/wilayah/${f}`, import.meta.url), 'utf8');
  for (const m of text.matchAll(ROW)) {
    if (!m[1].startsWith(`${CITY.code}.`)) continue;
    features.push({ code: m[1], name: m[2].replace(/''/g, "'"), geojson: toGeoJson(m[3]) });
  }
}
const kecCount = features.filter((f) => f.code.length === 8).length;
const kelCount = features.filter((f) => f.code.length === 13).length;
console.log(`dibaca: ${kecCount} kecamatan, ${kelCount} kelurahan (kode ${CITY.code})`);
if (!kecCount || !kelCount) throw new Error('Berkas sumber kosong atau formatnya berubah.');

// Mengisi lubang di dalam poligon. Lubang di sini hanya celah tipis (< 6 m) antar-poligon yang disederhanakan
// sumbernya, bukan wilayah sungguhan.
const fillHoles = (g: SQL) =>
  sql`st_multi((select st_union(st_makepolygon(st_exteriorring(d.geom))) from st_dump(${g}) d))`;
const asGeo = (g: SQL) => sql`${g}::geography`;
const pointOnSurface = sql`st_pointonsurface(w.g)`;

const report = await db.transaction(async (tx) => {
  const city = (
    await tx.execute(
      sql`select id from locations where slug = ${CITY.slug} and level = 'city' for update`
    )
  ).rows[0] as { id: number } | undefined;
  if (!city) throw new Error(`Lokasi slug "${CITY.slug}" belum ada. Jalankan db:seed-reference dulu.`);

  await tx.execute(
    sql`create temp table wb (code text primary key, name text not null, g geometry) on commit drop`
  );
  await tx.execute(sql`insert into wb (code, name, g) values ${sql.join(
    features.map(
      (f) =>
        sql`(${f.code}, ${f.name}, st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson(${f.geojson}), 4326)), 3)))`
    ),
    sql`, `
  )}`);

  // Kecamatan = gabungan kelurahannya. Poligon kecamatan di sumber jauh lebih kasar (8–19 titik, saling tumpang
  // tindih ±6 km²); gabungan kelurahan lebih teliti dan pasti selaras dengan kelurahan di dalamnya.
  // Poligon kecamatan sumber hanya dipakai bila kelurahannya tidak ada.
  await tx.execute(sql`
    update wb k set g = ${fillHoles(sql`u.g`)}
    from (select left(code, 8) as kec, st_union(g) as g from wb where length(code) = 13 group by 1) u
    where k.code = u.kec`);

  // Kecamatan: nama di bawah kota.
  await tx.execute(sql`
    update locations l set boundary = ${asGeo(sql`w.g`)}, official_code = w.code,
      lat = coalesce(l.lat, st_y(${pointOnSurface})), lng = coalesce(l.lng, st_x(${pointOnSurface})),
      updated_at = now()
    from wb w
    where length(w.code) = 8 and l.level = 'district' and l.parent_id = ${city.id}
      and ${normSql(sql`l.name`)} = ${normSql(sql`w.name`)}`);

  // Kelurahan: nama di bawah kecamatan yang sudah berkode.
  await tx.execute(sql`
    update locations l set boundary = ${asGeo(sql`w.g`)}, official_code = w.code,
      lat = coalesce(l.lat, st_y(${pointOnSurface})), lng = coalesce(l.lng, st_x(${pointOnSurface})),
      updated_at = now()
    from wb w
    join locations d on d.official_code = left(w.code, 8) and d.parent_id = ${city.id}
    where length(w.code) = 13 and l.level = 'village' and l.parent_id = d.id
      and ${normSql(sql`l.name`)} = ${normSql(sql`w.name`)}`);

  // Kota = gabungan semua kecamatannya (dari sumber, bukan hanya yang cocok).
  await tx.execute(sql`
    update locations set boundary = ${asGeo(fillHoles(sql`(select st_union(g) from wb where length(code) = 8)`))},
      official_code = ${CITY.code}, updated_at = now()
    where id = ${city.id}`);
  await tx.execute(sql`
    update locations set lat = st_y(st_pointonsurface(boundary::geometry)), lng = st_x(st_pointonsurface(boundary::geometry))
    where id = ${city.id} and lat is null`);

  const unmatched = (
    await tx.execute(
      sql`select w.code, w.name from wb w where not exists (select 1 from locations l where l.official_code = w.code) order by 1`
    )
  ).rows as { code: string; name: string }[];
  const withoutPolygon = (
    await tx.execute(sql`
      select l.name, l.level::text as level from locations l
      left join locations d on d.id = l.parent_id
      where l.boundary is null and l.level in ('district', 'village')
        and (l.parent_id = ${city.id} or d.parent_id = ${city.id})
      order by 2, 1`)
  ).rows as { name: string; level: string }[];
  return { unmatched, withoutPolygon };
});

console.log(
  `cocok: ${features.length - report.unmatched.length} dari ${features.length} fitur, ditambah poligon kota`
);
console.log(
  'fitur sumber tanpa pasangan di locations:',
  report.unmatched.length ? report.unmatched : 'tidak ada'
);
console.log(
  'kecamatan/kelurahan Padang di locations tanpa poligon:',
  report.withoutPolygon.length ? report.withoutPolygon : 'tidak ada'
);
process.exit(0);
