// Mesin Lokasi (PRD 8.15): titik → wilayah lewat poligon PostGIS, nama daerah → wilayah lewat gazetteer,
// area layanan penyedia, dan urutan jarak garis lurus. Kontrak: ../contracts.ts
//
// Privasi (UU PDP): mesin ini hanya MEMBACA database. Koordinat warga dipakai untuk satu query lalu dilupakan;
// location.check.ts menjalankan semua fungsi di koneksi baca-saja untuk memastikannya.
// Pakai binding dari ../contracts hanya di dalam fungsi, bukan di tingkat atas modul.
import { type SQL, sql } from 'drizzle-orm';
import { db } from '@/db';
import { pgArray } from '@/lib/directory/sql';
import { keepTopLevel, norm, normSql, resolveLocation } from '@/lib/directory/understand';
import type {
  LocationEngine,
  LocationLevel,
  NearestQuery,
  PlaceContext,
  PlaceResolution,
  Point,
  PointResolution,
  Region,
  VisitMode
} from '../contracts';

/** Kota yang dilayani Kamanga (slug di `locations`). Tahap 1: Padang saja. */
export const SERVICE_REGION_SLUGS = ['padang'];

/** Area layanan bawaan penyedia panggilan yang belum mengisi daftar wilayah maupun radius:
 *  kecamatannya sendiri + radius ini dari markas. ASUMSI sampai PRD §18 no. 9 diputuskan. */
export const DEFAULT_SERVICE_RADIUS_KM = 5;

/** Toleransi titik-di-poligon (meter). Poligon sumber disederhanakan, jadi ada celah tipis (< 6 m) antar-kelurahan;
 *  titik di celah itu tetap dianggap masuk wilayah terdekat. */
const EDGE_M = 25;

/** Hasil "mirip" (salah ketik) baru dipilih otomatis bila kemiripannya setinggi ini. */
const FUZZY_SURE = 0.6;
const MAX_OPTIONS = 5;

// Kata penunjuk tempat di awal ("di Koto Baru"); sama dengan LOCATION_LEAD di directory/understand.ts.
const LEAD = /^(?:di|ke|dari|daerah|sekitar|dekat|area|wilayah|kawasan)\s+/;

/** Mode kunjungan → nilai `listings.service_modes`. */
const SERVICE_MODE: Record<VisitMode, string> = {
  visit: 'on_site',
  call: 'on_call',
  online: 'online'
};

type Row = Record<string, unknown>;

/** Titik warga sebagai geography PostGIS. Menolak koordinat mustahil (masukan dari peramban). */
function geo(p: Point): SQL {
  const ok = Number.isFinite(p.lat) && Number.isFinite(p.lng);
  if (!ok || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)
    throw new RangeError('Titik tidak valid');
  return sql`st_setsrid(st_makepoint(${p.lng}::float8, ${p.lat}::float8), 4326)::geography`;
}

/** "Kota Padang" → "Padang", "Kabupaten Agam" → "Agam". */
const shortName = (name: string) => name.replace(/^(Kota|Kabupaten) /, '');

const toRegion = (r: Row): Region => ({
  id: Number(r.id),
  name: String(r.name),
  level: r.level as LocationLevel,
  parentName: r.parent_name ? shortName(String(r.parent_name)) : null,
  center: r.lat == null ? null : { lat: Number(r.lat), lng: Number(r.lng) }
});

async function serviceRegionIds(): Promise<number[]> {
  const rows = (
    await db.execute(sql`
      select id from locations
      where level = 'city' and slug = any(${pgArray(SERVICE_REGION_SLUGS, 'text')}) order by id`)
  ).rows as Row[];
  return rows.map((r) => Number(r.id));
}

// ───────────────────────────── titik → wilayah ─────────────────────────────

async function resolvePoint(p: Point): Promise<PointResolution | null> {
  const pt = geo(p);
  // Poligon tingkat paling rinci yang memuat titik, lalu naik ke induk-induknya (jadi selalu selaras).
  const rows = (
    await db.execute(sql`
      with recursive hit as (
        select id from locations
        where boundary is not null and level in ('village', 'district', 'city')
          and st_dwithin(boundary, ${pt}, ${EDGE_M})
        order by array_position(array['village', 'district', 'city'], level::text), st_distance(boundary, ${pt})
        limit 1
      ), up as (
        select l.id, l.parent_id from locations l join hit using (id)
        union all
        select l.id, l.parent_id from locations l join up on l.id = up.parent_id
      )
      select l.id, l.name, l.level::text as level, l.lat, l.lng, pa.name as parent_name
      from up join locations l using (id) left join locations pa on pa.id = l.parent_id`)
  ).rows as Row[];
  if (!rows.length) return null;

  const at = (level: LocationLevel) => {
    const r = rows.find((x) => x.level === level);
    return r ? toRegion(r) : null;
  };
  const village = at('village');
  const district = at('district');
  const city = at('city');
  const label = [(district ?? village)?.name, city && shortName(city.name)]
    .filter(Boolean)
    .join(', ');
  const service = await serviceRegionIds();
  return { village, district, city, label, inServiceRegion: !!city && service.includes(city.id) };
}

// ───────────────────────────── nama daerah → wilayah ─────────────────────────────

/** Wilayah beserta leluhurnya (sampai 3 tingkat), status dilayani, dan jumlah pencarian di search_logs. */
async function loadRegions(where: SQL, service: number[]): Promise<Row[]> {
  return (
    await db.execute(sql`
      select l.id, l.name, l.level::text as level, l.parent_id, pa.name as parent_name, l.lat, l.lng,
        array_remove(array[pa.id, gp.id, ggp.id], null) as ancestors,
        array[l.id, pa.id, gp.id, ggp.id] && ${pgArray(service, 'int')} as in_service,
        (select count(*) from search_logs s where s.location_id = l.id)::int as searches
      from locations l
      left join locations pa on pa.id = l.parent_id
      left join locations gp on gp.id = pa.parent_id
      left join locations ggp on ggp.id = gp.parent_id
      where ${where}
      order by array_position(array['province', 'city', 'district', 'village', 'landmark'], l.level::text), l.name`)
  ).rows as Row[];
}

const lineage = (r: Row) => [Number(r.id), ...(r.ancestors as number[])];
/** Sama, induk/leluhur satu sama lain, atau saudara (induk sama). */
const near = (a: Row, b: Row) =>
  lineage(a).includes(Number(b.id)) ||
  lineage(b).includes(Number(a.id)) ||
  (a.parent_id != null && a.parent_id === b.parent_id);

async function resolvePlaceName(text: string, ctx: PlaceContext = {}): Promise<PlaceResolution> {
  const q = norm(text).replace(LEAD, '').trim();
  const found = await resolveLocation(text, 50);
  const cands = found.candidates;
  const service = await serviceRegionIds();
  const all = cands.length
    ? await loadRegions(
        sql`l.id = any(${pgArray(
          cands.map((c) => c.id),
          'int'
        )})`,
        service
      )
    : [];

  // Cocok persis (nama, slug, sebutan lain) semua dipakai; hasil "mirip" hanya yang cukup yakin.
  const fuzzy = cands[0]?.matchedBy === 'mirip';
  const sure = fuzzy
    ? found.best
      ? [found.best]
      : cands.filter((c) => c.score >= FUZZY_SURE)
    : cands;
  const sureIds = new Set(sure.map((c) => c.id));
  let rows = all.filter((r) => sureIds.has(Number(r.id)));

  // (1) Cakupan layanan. Bila tak satu pun kandidat di wilayah layanan, coba nama di wilayah layanan yang
  //     diawali kata itu: "Koto Baru" → "Koto Baru Nan XX" (Padang), "Gates" → "Gates Nan XX".
  if (!rows.some((r) => r.in_service) && q.length >= 3) {
    const prefixed = (
      await loadRegions(sql`${normSql(sql`l.name`)} like ${`${q} %`}`, service)
    ).filter((r) => r.in_service);
    if (prefixed.length) rows = prefixed;
  }
  if (!rows.length) {
    // Hanya mirip-mirip: tanyakan pilihannya, jangan menebak.
    return all.length
      ? { kind: 'ambiguous', options: all.slice(0, MAX_OPTIONS).map(toRegion) }
      : { kind: 'not_found' };
  }

  const narrow = (keep: (r: Row) => boolean) => {
    const kept = rows.filter(keep);
    if (kept.length) rows = kept;
  };
  narrow((r) => Boolean(r.in_service));
  rows = keepTopLevel(rows); // "Kuranji": kecamatan menang atas kelurahan Kuranji di dalamnya

  // (2) lokasi terakhir, (3) alamat tersimpan: pilih yang sama/dekat dengannya.
  const ctxIds = [ctx.lastLocationId, ...(ctx.savedLocationIds ?? [])].filter(
    (id): id is number => id != null
  );
  if (rows.length > 1 && ctxIds.length) {
    const ctxRows = await loadRegions(sql`l.id = any(${pgArray(ctxIds, 'int')})`, service);
    const last = ctxRows.find((r) => Number(r.id) === ctx.lastLocationId);
    if (last) narrow((r) => near(r, last));
    const saved = ctxRows.filter((r) => ctx.savedLocationIds?.includes(Number(r.id)));
    if (rows.length > 1 && saved.length) narrow((r) => saved.some((s) => near(r, s)));
  }

  // (4) wilayah yang paling sering dicari, bila jelas unggul.
  if (rows.length > 1) {
    const max = Math.max(...rows.map((r) => Number(r.searches)));
    const top = rows.filter((r) => Number(r.searches) === max);
    if (max > 0 && top.length === 1) rows = top;
  }

  if (rows.length === 1) return { kind: 'resolved', region: toRegion(rows[0]) };
  const options = rows.toSorted((a, b) => Number(b.searches) - Number(a.searches));
  return { kind: 'ambiguous', options: options.slice(0, MAX_OPTIONS).map(toRegion) };
}

// ───────────────────────────── area layanan dan jarak ─────────────────────────────

/** Syarat SQL "titik pt di dalam area layanan listing `li`" (tabel listings harus beralias `li`):
 *  di dalam poligon salah satu listing_areas, ATAU dalam service_radius_km dari markas, ATAU (bila keduanya
 *  kosong) bawaan: di kecamatan listing itu atau dalam DEFAULT_SERVICE_RADIUS_KM dari markas. */
const inServiceAreaSql = (pt: SQL) => sql`(
  exists (
    select 1 from listing_areas la join locations a on a.id = la.location_id
    where la.listing_id = li.id and st_dwithin(a.boundary, ${pt}, ${EDGE_M}))
  or coalesce(st_dwithin(li.point, ${pt}, li.service_radius_km * 1000), false)
  or (li.service_radius_km is null
    and not exists (select 1 from listing_areas la where la.listing_id = li.id)
    and (coalesce(st_dwithin(li.point, ${pt}, ${DEFAULT_SERVICE_RADIUS_KM * 1000}), false)
      or exists (
        select 1 from locations d
        where d.level = 'district' and st_dwithin(d.boundary, ${pt}, ${EDGE_M})
          and (d.id = li.location_id
            or d.id = (select v.parent_id from locations v where v.id = li.location_id)
            or coalesce(st_covers(d.boundary, li.point), false)))))
)`;

async function isInServiceArea(listingId: number, p: Point): Promise<boolean> {
  const rows = (
    await db.execute(
      sql`select 1 from listings li where li.id = ${listingId} and ${inServiceAreaSql(geo(p))}`
    )
  ).rows;
  return rows.length > 0;
}

async function nearestListings(
  q: NearestQuery
): Promise<{ listingId: number; distanceKm: number | null }[]> {
  const pt = q.mode === 'online' ? null : geo(q.origin);
  const where: SQL[] = [
    sql`li.status = 'published'`,
    sql`${SERVICE_MODE[q.mode]}::service_mode = any(li.service_modes)`
  ];
  if (q.listingIds) where.push(sql`li.id = any(${pgArray(q.listingIds, 'int')})`);
  if (q.categoryIds)
    where.push(sql`exists (
      select 1 from listing_categories lc
      where lc.listing_id = li.id and lc.category_id = any(${pgArray(q.categoryIds, 'int')}))`);
  // Listing tanpa titik tidak lolos batas radius (jaraknya tidak diketahui).
  if (pt && q.mode === 'visit' && q.radiusKm != null)
    where.push(sql`st_dwithin(li.point, ${pt}, ${q.radiusKm * 1000})`);
  if (pt && q.mode === 'call') where.push(inServiceAreaSql(pt));

  const km = pt ? sql`st_distance(li.point, ${pt}) / 1000` : sql`null::float8`;
  const rows = (
    await db.execute(sql`
      select li.id, ${km} as km from listings li
      where ${sql.join(where, sql` and `)}
      order by km nulls last, li.id
      limit ${q.limit ?? null}`)
  ).rows as Row[];
  return rows.map((r) => ({
    listingId: Number(r.id),
    distanceKm: r.km == null ? null : Number(r.km)
  }));
}

const oneDecimal = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});
const whole = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** "650 m" (< 1 km, kelipatan 50 m), "1,8 km" (< 10 km), "12 km". */
function formatDistance(km: number): string {
  const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (m < 1000) return `${m} m`;
  const tenths = Math.round(km * 10) / 10;
  return tenths < 10 ? `${oneDecimal.format(tenths)} km` : `${whole.format(km)} km`;
}

export const locationEngine: LocationEngine = {
  resolvePoint,
  resolvePlaceName,
  isInServiceArea,
  nearestListings,
  formatDistance,
  serviceRegionIds
};
