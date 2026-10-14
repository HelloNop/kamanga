// Pencarian penyedia tahap 1 untuk halaman pintu dan chat (PRD 8.3, 8.4, 8.15). Hanya listing terbit.
// - Syarat wajib menyaring: kategori, lokasi (jarak / area layanan), waktu tersedia + kursi, anggaran,
//   isian aturan yang diminta. Kandidat yang DATANYA KOSONG pada syarat wajib tidak lolos, tetapi
//   dikembalikan terpisah di `uncertain` ("belum pasti") beserta alasannya.
// - Peringkat memakai PROVIDER_WEIGHTS di ranking.ts.
// - Pelonggaran hanya DITAWARKAN beserta jumlah hasilnya (`relaxations`); tidak pernah diterapkan diam-diam.
// - Koordinat warga hanya dipakai untuk menghitung, tidak disimpan.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  location,
  schedule,
  type Point,
  type ScheduleKind,
  type Slot,
  type VisitMode
} from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import { photoUrl } from '@/lib/storage';
import {
  completenessScore,
  providerScore,
  reviewScore,
  verificationScore,
  type ProviderSignal
} from './ranking';
import { pgArray } from './sql';

const DEFAULT_RADIUS_KM = 15;

export type ProviderQuery = {
  categoryIds: number[];
  /** Titik layanan: lokasi perangkat atau alamat tersimpan. */
  origin?: Point | null;
  /** Wilayah yang diketik warga (hasil location.resolvePlaceName); titik tengahnya dipakai bila tanpa origin. */
  regionId?: number | null;
  /** visit: warga datang; call: penyedia datang. Bawaan: visit bila penyedia melayani di tempat. */
  prefer?: 'visit' | 'call';
  /** Rentang waktu yang diinginkan (hanya untuk kategori ber-jadwal slot/seat). */
  when?: { from: Date; to: Date } | null;
  seats?: number;
  /** Travel: id kota/wilayah asal dan tujuan. */
  route?: { fromId: number; toId: number } | null;
  /** Batas jarak untuk penyedia yang didatangi warga. Bawaan 15 km. */
  radiusKm?: number;
  /** Anggaran maksimal (dibandingkan dengan harga terendah listing). */
  budgetMax?: number | null;
  /** Isian aturan yang wajib cocok, mis. { racket_included: true }. */
  attributes?: Record<string, string | number | boolean>;
  /** false = ikut Tempat (informasi saja). Bawaan true. */
  providersOnly?: boolean;
  limit?: number;
  /** score: skor gabungan PRD 8.3 (bawaan); distance: terdekat dulu (daftar di halaman pintu, PRD 9.1). */
  sort?: 'score' | 'distance';
  /** Jumlah slot kosong per penyedia yang dikembalikan. Bawaan 6. */
  slotsPerListing?: number;
};

export type ProviderCard = {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  photo: string | null;
  kind: 'provider' | 'place';
  category: {
    id: number;
    slug: string;
    name: string;
    scheduleKind: ScheduleKind;
    doorSlug: string | null;
  };
  /** "Kuranji, Padang". Untuk penyedia rumahan hanya sampai kecamatan (memang tidak ada alamat di sini). */
  place: string | null;
  mode: VisitMode;
  distanceKm: number | null;
  distanceLabel: string | null;
  verification: string;
  rating: { satisfied: number; count: number } | null;
  price: { min: number | null; max: number | null; unit: string | null };
  /** Slot kosong terdekat dalam rentang yang diminta (kosong bila tanpa rentang atau tanpa jadwal). */
  slots: Slot[];
  /** Bisa dipesan lewat Kamanga (rencana-tahap1 keputusan 14). */
  bookable: boolean;
  /** Hanya untuk Tempat: kontak informasi. */
  info: { phone: string | null; mapsUrl: string | null } | null;
  /** Untuk `uncertain`: syarat wajib yang datanya kosong. */
  missing: string[];
  score: number;
  parts: Partial<Record<ProviderSignal, { value: number; weight: number }>>;
};

export type Relaxation = {
  key: 'radius' | 'time' | 'budget' | 'attributes';
  label: string;
  count: number;
};

export type ProviderResult = {
  items: ProviderCard[];
  uncertain: ProviderCard[];
  /** Bila hasil sedikit: pelonggaran yang bisa dipilih warga beserta jumlah hasilnya. */
  relaxations: Relaxation[];
  total: number;
};

type Row = {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  kind: 'provider' | 'place';
  photo: string | null;
  lat: number | null;
  lng: number | null;
  modes: string[];
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  maps_url: string | null;
  location_id: number | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  attributes: Record<string, unknown>;
  ver: string;
  is_primary: boolean;
  cat_id: number;
  cat_slug: string;
  cat_name: string;
  schedule_kind: ScheduleKind;
  door_slug: string | null;
  door_status: string | null;
  loc_name: string | null;
  par_name: string | null;
  rev_count: number;
  rev_ok: number;
};

async function candidates(q: ProviderQuery): Promise<Row[]> {
  const cats = pgArray(q.categoryIds, 'int');
  const rows = (
    await db.execute(sql`
      select distinct on (l.id)
        l.id, l.slug, l.name, l.summary, l.description, l.kind::text as kind, l.photos[1] as photo,
        l.lat, l.lng, l.service_modes::text[] as modes, l.whatsapp, l.phone, l.instagram, l.website,
        l.maps_url, l.location_id, l.price_min, l.price_max, l.price_unit::text as price_unit,
        l.attributes, l.verification_level::text as ver, lc.is_primary,
        c.id as cat_id, c.slug as cat_slug, c.name as cat_name, c.schedule_kind::text as schedule_kind,
        d.slug as door_slug, d.status::text as door_status,
        loc.name as loc_name, par.name as par_name,
        (select count(*)::int from reviews r where r.listing_id = l.id) as rev_count,
        (select count(*)::int from reviews r where r.listing_id = l.id and r.satisfied) as rev_ok
      from listings l
      join listing_categories lc on lc.listing_id = l.id and lc.category_id = any(${cats})
      join categories c on c.id = lc.category_id
      left join doors d on d.id = c.door_id
      left join locations loc on loc.id = l.location_id
      left join locations par on par.id = loc.parent_id and loc.level in ('district', 'village', 'landmark')
      where l.status = 'published' ${q.providersOnly === false ? sql`` : sql`and l.kind = 'provider'`}
      order by l.id, lc.is_primary desc`)
  ).rows as Row[];
  return rows.map((r) => ({
    ...r,
    id: Number(r.id),
    cat_id: Number(r.cat_id),
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    location_id: r.location_id === null ? null : Number(r.location_id),
    price_min: r.price_min === null ? null : Number(r.price_min),
    price_max: r.price_max === null ? null : Number(r.price_max),
    rev_count: Number(r.rev_count),
    rev_ok: Number(r.rev_ok)
  }));
}

/** Cara layanan yang dipakai untuk satu listing. */
function modeOf(modes: string[], prefer?: 'visit' | 'call'): VisitMode {
  const onSite = modes.includes('on_site');
  const onCall = modes.includes('on_call');
  if (prefer === 'call' && onCall) return 'call';
  if (onSite) return 'visit';
  if (onCall) return 'call';
  return 'online';
}

const attrMatches = (v: unknown, want: string | number | boolean) => {
  if (Array.isArray(v))
    return v.some((x) => String(x).toLowerCase() === String(want).toLowerCase());
  if (typeof want === 'string') return String(v).toLowerCase() === want.toLowerCase();
  return v === want;
};

const cityLabel = (s: string | null) => (s ? s.replace(/^(Kota|Kabupaten) /, '') : null);

/** Satu putaran penyaringan tanpa pelonggaran. */
async function evaluate(q: ProviderQuery) {
  const rows = await candidates(q);
  const missing = new Map<number, string[]>();
  // Data kosong pada syarat wajib: tetap disimpan, tapi masuk "belum pasti".
  const keep = (id: number, why: string) => {
    missing.set(id, [...(missing.get(id) ?? []), why]);
    return true;
  };
  let pool = rows;

  // Anggaran dan isian aturan
  if (q.budgetMax) {
    pool = pool.filter((r) => {
      if (r.price_min === null) return keep(r.id, 'harga');
      return r.price_min <= q.budgetMax!;
    });
  }
  for (const [key, want] of Object.entries(q.attributes ?? {})) {
    pool = pool.filter((r) => {
      const v = r.attributes?.[key];
      if (v === undefined || v === null || v === '') return keep(r.id, key);
      return attrMatches(v, want);
    });
  }

  // Lokasi: titik warga, atau titik tengah wilayah yang diketik.
  let origin = q.origin ?? null;
  if (!origin && q.regionId) {
    const [c] = (
      await db.execute(
        sql`select lat, lng from locations where id = ${q.regionId} and lat is not null`
      )
    ).rows as { lat: number; lng: number }[];
    if (c) origin = { lat: Number(c.lat), lng: Number(c.lng) };
  }
  const modeById = new Map(pool.map((r) => [r.id, modeOf(r.modes, q.prefer)]));
  const dist = new Map<number, number | null>();
  const radiusKm = q.radiusKm ?? DEFAULT_RADIUS_KM;
  if (origin) {
    const ids = (m: VisitMode) => pool.filter((r) => modeById.get(r.id) === m).map((r) => r.id);
    const [visit, call] = await Promise.all([
      ids('visit').length
        ? location.nearestListings({ origin, mode: 'visit', listingIds: ids('visit'), radiusKm })
        : [],
      ids('call').length
        ? location.nearestListings({ origin, mode: 'call', listingIds: ids('call') })
        : []
    ]);
    for (const n of [...visit, ...call]) dist.set(n.listingId, n.distanceKm);
    pool = pool.filter((r) => {
      const m = modeById.get(r.id);
      if (m === 'online') return true;
      if (!dist.has(r.id)) {
        // Didatangi warga tapi tanpa titik: belum pasti, bukan lolos.
        if (m === 'visit' && r.lat === null) return keep(r.id, 'lokasi');
        return false;
      }
      if (m === 'visit' && dist.get(r.id) === null) return keep(r.id, 'lokasi');
      return true;
    });
  }

  // Ketersediaan (kategori ber-jadwal + rentang waktu diminta)
  const slotsBy = new Map<number, Slot[]>();
  const timed = (r: Row) => r.schedule_kind === 'slot' || r.schedule_kind === 'seat';
  if (q.when && pool.some(timed)) {
    const timedIds = pool.filter(timed).map((r) => r.id);
    let unitSql = sql`select id, listing_id from units where is_active and listing_id = any(${pgArray(timedIds, 'int')})`;
    if (q.route) {
      // Rute cocok bila asal/tujuan unit = wilayah yang diminta atau salah satu induknya (kecamatan → kota).
      const chain = (id: number) =>
        sql`(with recursive up as (select id, parent_id from locations where id = ${id}
              union all select l.id, l.parent_id from locations l join up on l.id = up.parent_id)
             select id from up)`;
      unitSql = sql`${unitSql} and origin_location_id in ${chain(q.route.fromId)}
        and destination_location_id in ${chain(q.route.toId)}`;
    }
    const unitRows = (await db.execute(unitSql)).rows as { id: number; listing_id: number }[];
    const listingOfUnit = new Map(unitRows.map((u) => [Number(u.id), Number(u.listing_id)]));
    const slots = unitRows.length
      ? await schedule.getAvailability({
          unitIds: [...listingOfUnit.keys()],
          from: q.when.from,
          to: q.when.to,
          seats: q.seats ?? 1
        })
      : [];
    for (const s of slots) {
      const lid = listingOfUnit.get(s.unitId)!;
      slotsBy.set(lid, [...(slotsBy.get(lid) ?? []), s]);
    }
    const hasUnits = new Set(listingOfUnit.values());
    pool = pool.filter((r) => {
      if (!timed(r)) return true;
      if (!hasUnits.has(r.id)) return q.route ? false : keep(r.id, 'jadwal');
      return (slotsBy.get(r.id)?.length ?? 0) > 0;
    });
  }

  const cards = pool.map((r) => toCard(r, q, origin, modeById.get(r.id)!, dist, slotsBy, missing));
  const near = (a: ProviderCard, b: ProviderCard) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9);
  const sort = (a: ProviderCard, b: ProviderCard) =>
    q.sort === 'distance'
      ? near(a, b) || b.score - a.score || a.id - b.id
      : b.score - a.score || near(a, b) || a.id - b.id;
  return {
    items: cards.filter((c) => !c.missing.length).sort(sort),
    uncertain: cards.filter((c) => c.missing.length).sort(sort)
  };
}

function toCard(
  r: Row,
  q: ProviderQuery,
  origin: Point | null,
  mode: VisitMode,
  dist: Map<number, number | null>,
  slotsBy: Map<number, Slot[]>,
  missing: Map<number, string[]>
): ProviderCard {
  const distanceKm = dist.get(r.id) ?? null;
  const slots = (slotsBy.get(r.id) ?? []).slice(0, q.slotsPerListing ?? 6);
  const radius = q.radiusKm ?? DEFAULT_RADIUS_KM;
  const locationSignal =
    !origin || mode === 'online'
      ? undefined
      : distanceKm === null
        ? 0
        : mode === 'visit'
          ? Math.max(0, 1 - distanceKm / radius)
          : Math.max(0.3, 1 - distanceKm / 30); // penyedia datang: jarak markas kurang menentukan
  const timed = r.schedule_kind === 'slot' || r.schedule_kind === 'seat';
  const { score, parts } = providerScore({
    relevance: r.is_primary ? 1 : 0.7,
    location: locationSignal,
    availability: q.when && timed ? (slots.length ? 1 : 0) : undefined,
    verification: verificationScore(r.ver),
    reviews: reviewScore(r.rev_ok, r.rev_count),
    completeness: completenessScore({
      hasContact: !!(r.whatsapp || r.phone),
      hasSummary: !!r.summary,
      hasDescription: !!r.description,
      hasLocation: r.location_id !== null,
      hasCoords: r.lat !== null,
      hasPrice: r.price_min !== null || r.price_max !== null,
      hasLinks: !!(r.instagram || r.website || r.maps_url),
      infoOnly: r.kind === 'place'
    })
  });
  const bookable =
    r.kind === 'provider' &&
    r.door_status === 'active' &&
    ['slot', 'seat', 'none'].includes(r.schedule_kind) &&
    r.ver !== 'unverified' &&
    !!r.whatsapp;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    photo: r.photo ? photoUrl(r.photo) : null,
    kind: r.kind,
    category: {
      id: r.cat_id,
      slug: r.cat_slug,
      name: r.cat_name,
      scheduleKind: r.schedule_kind,
      doorSlug: r.door_slug
    },
    place: [r.loc_name, cityLabel(r.par_name)].filter(Boolean).join(', ') || null,
    mode,
    distanceKm,
    distanceLabel: distanceKm === null ? null : location.formatDistance(distanceKm),
    verification: r.ver,
    rating: r.rev_count ? { satisfied: r.rev_ok, count: r.rev_count } : null,
    price: { min: r.price_min, max: r.price_max, unit: r.price_unit },
    slots,
    bookable,
    info: r.kind === 'place' ? { phone: r.phone, mapsUrl: r.maps_url } : null,
    missing: missing.get(r.id) ?? [],
    score,
    parts
  };
}

export async function findProviders(q: ProviderQuery): Promise<ProviderResult> {
  const limit = Math.min(Math.max(q.limit ?? 10, 1), 30);
  if (!q.categoryIds.length) return { items: [], uncertain: [], relaxations: [], total: 0 };
  const main = await evaluate(q);

  const relaxations: Relaxation[] = [];
  if (main.items.length < 3) {
    const tries: { key: Relaxation['key']; label: string; q: ProviderQuery }[] = [];
    const radius = q.radiusKm ?? DEFAULT_RADIUS_KM;
    if ((q.origin || q.regionId) && radius < 60)
      tries.push({
        key: 'radius',
        label: `perluas jarak jadi ${radius * 3} km`,
        q: { ...q, radiusKm: radius * 3 }
      });
    if (q.when) {
      const day = jakartaDate(q.when.from);
      tries.push({
        key: 'time',
        label: 'lihat jam lain hari itu dan besoknya',
        q: {
          ...q,
          when: { from: fromJakarta(day, '00:00'), to: fromJakarta(addDays(day, 2), '00:00') }
        }
      });
    }
    if (q.budgetMax)
      tries.push({ key: 'budget', label: 'abaikan anggaran', q: { ...q, budgetMax: null } });
    if (q.attributes && Object.keys(q.attributes).length) {
      // Nama isian untuk warga ("Termasuk raket"), bukan kuncinya.
      const defs = (
        await db.execute(sql`select attribute_schema from categories
          where id = any(${pgArray(q.categoryIds, 'int')})`)
      ).rows.flatMap((r) => parseAttributeSchema(r.attribute_schema));
      const label = (k: string) => defs.find((d) => d.key === k)?.label.toLowerCase() ?? k;
      tries.push({
        key: 'attributes',
        label: `abaikan syarat ${Object.keys(q.attributes).map(label).join(', ')}`,
        q: { ...q, attributes: undefined }
      });
    }
    for (const t of tries) {
      const n = (await evaluate(t.q)).items.length;
      if (n > main.items.length) relaxations.push({ key: t.key, label: t.label, count: n });
    }
  }
  return {
    items: main.items.slice(0, limit),
    uncertain: main.uncertain.slice(0, 5),
    relaxations,
    total: main.items.length
  };
}
