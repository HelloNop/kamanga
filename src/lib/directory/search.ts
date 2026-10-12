// Pencarian listing untuk warga/chatbot. Hanya membaca listing berstatus `published`.
// Alur: (1) saring kandidat di database, (2) beri skor di sini (lihat ranking.ts), (3) urutkan dan potong.
// ponytail: skor dihitung di memori untuk maksimal 500 kandidat; pindah ke SQL bila listing sudah puluhan ribu.
// Pencarian semantik (pgvector) belum dipakai: menunggu pemilihan model embedding. Kata dicocokkan lewat trigram.
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  EXTRA_CATEGORY,
  MIN_TEXT_RELEVANCE,
  PRIMARY_CATEGORY,
  completenessScore,
  geoScore,
  priceScore,
  reasonsOf,
  relevanceOf,
  scoreOf,
  verificationScore,
  type ScoreParts
} from './ranking';
import { photoUrl } from '@/lib/storage';
import { pgArray } from './sql';
import { norm, normSql } from './understand';

const CANDIDATE_CAP = 500;
const DEFAULT_RADIUS_KM = 15;
const ATTR_KEY = /^[a-z][a-z0-9_]{0,29}$/;

export type SearchParams = {
  /** Kata bebas. Dipakai untuk relevansi; bila tanpa kategori, juga untuk menyaring. */
  q?: string;
  /** Kategori yang sudah dipastikan (lewat resolveCategories atau pilihan admin). Listing harus punya salah satunya. */
  categoryIds?: number[];
  /** Lokasi bernama (hasil resolveLocation). */
  locationId?: number;
  /** Titik koordinat (mis. GPS pengguna). Mengalahkan titik tengah lokasi bernama. */
  near?: { lat: number; lng: number };
  radiusKm?: number;
  serviceModes?: ('on_site' | 'on_call' | 'online')[];
  minVerification?: 'contact_checked' | 'visited';
  budget?: { max: number; unit?: string };
  /** Atribut angka, mis. { key: 'capacity', min: 300 }. Listing tanpa atribut itu dikeluarkan. */
  attributeFilters?: { key: string; min?: number; max?: number }[];
  limit?: number;
  offset?: number;
};

export type SearchItem = {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  category: { slug: string; name: string; group: string } | null;
  location: { name: string; parentName: string | null } | null;
  distanceKm: number | null;
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  mapsUrl: string | null;
  /** Alamat foto sampul (yang sudah disetujui), bila ada. */
  photo: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceUnit: string | null;
  priceNote: string | null;
  verification: string;
  serviceModes: string[];
  attributes: Record<string, unknown>;
  score: number;
  parts: ScoreParts;
  reasons: string[];
};

export type SearchResult = {
  items: SearchItem[];
  total: number; // jumlah yang cocok (maksimal CANDIDATE_CAP)
  truncated: boolean; // true bila ada lebih banyak dari batas kandidat
  applied: {
    q: string | null;
    categoryIds: number[];
    location: { id: number; name: string; level: string } | null;
    origin: 'near' | 'lokasi' | 'induk' | null;
    radiusKm: number;
  };
  /** Bila hasil sedikit: perubahan syarat yang akan menambah hasil, beserta jumlahnya. */
  alternatives: { label: string; count: number }[];
};

type Row = Record<string, unknown>;
type Loc = {
  id: number;
  parentId: number | null;
  level: string;
  name: string;
  lat: number | null;
  lng: number | null;
};

async function loadGazetteer() {
  const rows = (
    await db.execute(sql`select id, parent_id, level::text as level, name, lat, lng from locations`)
  ).rows as Row[];
  const byId = new Map<number, Loc>();
  const children = new Map<number, number[]>();
  for (const r of rows) {
    const l: Loc = {
      id: Number(r.id),
      parentId: r.parent_id === null ? null : Number(r.parent_id),
      level: String(r.level),
      name: String(r.name),
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng)
    };
    byId.set(l.id, l);
    if (l.parentId !== null) children.set(l.parentId, [...(children.get(l.parentId) ?? []), l.id]);
  }
  const subtree = (id: number) => {
    const out = new Set<number>();
    const stack = [id];
    while (stack.length) {
      const x = stack.pop()!;
      if (out.has(x)) continue;
      out.add(x);
      stack.push(...(children.get(x) ?? []));
    }
    return out;
  };
  const ancestorsSelf = (id: number) => {
    const out: Loc[] = [];
    for (let l = byId.get(id); l; l = l.parentId === null ? undefined : byId.get(l.parentId))
      out.push(l);
    return out;
  };
  return { byId, subtree, ancestorsSelf };
}

type Ctx = {
  location: Loc | null;
  ancestorIds: number[]; // lokasi + semua induknya
  samePlace: Set<number>; // lokasi + semua turunannya
  sameParent: Set<number>; // turunan induknya (bila lokasi setingkat kecamatan/kelurahan/tempat)
  origin: { lat: number; lng: number; from: 'near' | 'lokasi' | 'induk' } | null;
  radiusKm: number;
  geoActive: boolean;
};

async function buildContext(p: SearchParams): Promise<Ctx> {
  const radiusKm = Math.min(Math.max(p.radiusKm ?? DEFAULT_RADIUS_KM, 1), 100);
  const ctx: Ctx = {
    location: null,
    ancestorIds: [],
    samePlace: new Set(),
    sameParent: new Set(),
    origin: null,
    radiusKm,
    geoActive: false
  };
  if (p.locationId === undefined && !p.near) return ctx;

  if (p.locationId !== undefined) {
    const gz = await loadGazetteer();
    const L = gz.byId.get(p.locationId);
    if (L) {
      const chain = gz.ancestorsSelf(L.id);
      ctx.location = L;
      ctx.ancestorIds = chain.map((l) => l.id);
      ctx.samePlace = gz.subtree(L.id);
      if (['district', 'village', 'landmark'].includes(L.level) && L.parentId !== null)
        ctx.sameParent = gz.subtree(L.parentId);
      const withCoords = chain.find((l) => l.lat !== null && l.lng !== null);
      if (withCoords)
        ctx.origin = {
          lat: withCoords.lat!,
          lng: withCoords.lng!,
          from: withCoords.id === L.id ? 'lokasi' : 'induk'
        };
    }
  }
  if (p.near) ctx.origin = { ...p.near, from: 'near' };
  ctx.geoActive = !!ctx.location || !!ctx.origin;
  return ctx;
}

function buildQuery(p: SearchParams, ctx: Ctx, q: string | null, catIds: number[]) {
  const nameN = normSql(sql`l.name`);
  const textRel = q
    ? sql`greatest(
        similarity(${nameN}, ${q}), word_similarity(${q}, ${nameN}),
        coalesce((select max(greatest(similarity(${normSql(sql`k`)}, ${q}), word_similarity(${q}, ${normSql(sql`k`)}), word_similarity(${normSql(sql`k`)}, ${q}))) from unnest(l.keywords) as k), 0),
        0.9 * similarity(${normSql(sql`pc.name`)}, ${q}), 0.9 * word_similarity(${q}, ${normSql(sql`pc.name`)}),
        0.6 * word_similarity(${q}, ${normSql(sql`l.summary`)}))::float8`
    : sql`null::float8`;
  const catMatch = catIds.length
    ? sql`coalesce((select max(case when lc.is_primary then ${PRIMARY_CATEGORY}::float8 else ${EXTRA_CATEGORY}::float8 end) from listing_categories lc where lc.listing_id = l.id and lc.category_id = any(${pgArray(catIds, 'int')})), 0)::float8`
    : sql`null::float8`;
  const dist = ctx.origin
    ? sql`case when l.lat is not null then (earth_distance(ll_to_earth(${ctx.origin.lat}::float8, ${ctx.origin.lng}::float8), ll_to_earth(l.lat, l.lng)) / 1000)::float8 end`
    : sql`null::float8`;

  const where: SQL[] = [sql`l.status = 'published'`];
  if (catIds.length)
    where.push(
      sql`exists (select 1 from listing_categories lc where lc.listing_id = l.id and lc.category_id = any(${pgArray(catIds, 'int')}))`
    );
  if (p.serviceModes?.length)
    where.push(sql`l.service_modes && ${pgArray(p.serviceModes, 'service_mode')}`);
  if (p.minVerification)
    where.push(sql`l.verification_level >= ${p.minVerification}::verification_level`);
  if (p.budget) {
    where.push(
      p.budget.unit
        ? sql`(l.price_min is null or l.price_min <= ${p.budget.max} or (l.price_unit is not null and l.price_unit::text <> ${p.budget.unit}))`
        : sql`(l.price_min is null or l.price_min <= ${p.budget.max})`
    );
  }
  for (const f of p.attributeFilters ?? []) {
    if (!ATTR_KEY.test(f.key)) continue;
    const num = sql`(l.attributes ->> ${f.key}::text)::numeric`;
    const checks = [sql`jsonb_typeof(l.attributes -> ${f.key}::text) = 'number'`];
    if (f.min !== undefined) checks.push(sql`${num} >= ${f.min}`);
    if (f.max !== undefined) checks.push(sql`${num} <= ${f.max}`);
    where.push(sql`(${sql.join(checks, sql` and `)})`);
  }
  if (ctx.geoActive) {
    const ors: SQL[] = [sql`'online' = any(l.service_modes)`];
    const here = ctx.sameParent.size ? ctx.sameParent : ctx.samePlace;
    if (here.size) ors.push(sql`l.location_id = any(${pgArray([...here], 'int')})`);
    if (ctx.ancestorIds.length)
      ors.push(
        sql`exists (select 1 from listing_areas la where la.listing_id = l.id and la.location_id = any(${pgArray(ctx.ancestorIds, 'int')}))`
      );
    if (ctx.origin) {
      const o = sql`ll_to_earth(${ctx.origin.lat}::float8, ${ctx.origin.lng}::float8)`;
      ors.push(
        sql`(l.lat is not null and earth_box(${o}, ${ctx.radiusKm * 1000}::float8) @> ll_to_earth(l.lat, l.lng) and earth_distance(${o}, ll_to_earth(l.lat, l.lng)) <= ${ctx.radiusKm * 1000}::float8)`
      );
    }
    where.push(sql`(${sql.join(ors, sql` or `)})`);
  }
  // Pencarian hanya berdasar kata: buang yang tidak nyambung.
  const outer = q && !catIds.length ? sql`text_rel >= ${MIN_TEXT_RELEVANCE}` : sql`true`;

  return sql`
    select * from (
      select
        l.id, l.slug, l.name, l.summary, l.description, l.address, l.location_id, l.lat, l.lng,
        l.service_modes::text[] as service_modes,
        l.whatsapp, l.phone, l.instagram, l.website, l.maps_url, l.photos[1] as cover_photo,
        l.price_min, l.price_max, l.price_unit::text as price_unit, l.price_note,
        l.verification_level::text as verification_level, l.attributes, (l.opening_hours is not null) as has_hours,
        pc.slug as category_slug, pc.name as category_name,
        (select gr.name from category_groups gr where gr.id = pc.group_id) as category_group, pc.info_only as category_info_only,
        loc.name as location_name, par.name as parent_name,
        ${catMatch} as cat_match, ${textRel} as text_rel, ${dist} as dist_km,
        coalesce((select array_agg(la.location_id) from listing_areas la where la.listing_id = l.id), '{}') as area_ids
      from listings l
      left join listing_categories plc on plc.listing_id = l.id and plc.is_primary
      left join categories pc on pc.id = plc.category_id
      left join locations loc on loc.id = l.location_id
      left join locations par on par.id = loc.parent_id
      where ${sql.join(
        where.map((w) => sql`(${w})`),
        sql` and `
      )}
    ) t
    where ${outer}
    order by coalesce(text_rel, 0) desc, dist_km asc nulls last, id
    limit ${CANDIDATE_CAP + 1}`;
}

const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

async function rank(p: SearchParams) {
  const ctx = await buildContext(p);
  const q = p.q ? norm(p.q) || null : null;
  const catIds = [...new Set(p.categoryIds ?? [])];
  const rows = (await db.execute(buildQuery(p, ctx, q, catIds))).rows as Row[];
  const truncated = rows.length > CANDIDATE_CAP;
  const budget = p.budget && p.budget.max > 0 ? p.budget : undefined;

  const items: SearchItem[] = [];
  for (const r of rows.slice(0, CANDIDATE_CAP)) {
    const catMatch = numOrNull(r.cat_match);
    const textRel = numOrNull(r.text_rel);
    const distKm = numOrNull(r.dist_km);
    const locId = numOrNull(r.location_id);
    const areaIds = ((r.area_ids as number[] | null) ?? []).map(Number);
    const modes = (r.service_modes as string[]) ?? [];
    const verification = String(r.verification_level);
    const group = (r.category_group as string | null) ?? '';

    const price = priceScore(
      {
        min: numOrNull(r.price_min),
        max: numOrNull(r.price_max),
        unit: (r.price_unit as string | null) ?? null
      },
      budget
    );
    if (price === null) continue; // melebihi anggaran

    const geo = {
      samePlace: locId !== null && ctx.samePlace.has(locId),
      sameParent: locId !== null && !ctx.samePlace.has(locId) && ctx.sameParent.has(locId),
      coversArea: areaIds.some((a) => ctx.ancestorIds.includes(a)),
      online: modes.includes('online'),
      distKm
    };
    // Jarak dari titik tengah kota (bukan titik sebenarnya) kurang bisa dipercaya: bobotnya dikurangi separuh.
    const proximityKm =
      ctx.origin?.from === 'induk' ? (distKm === null ? null : distKm * 2) : distKm;
    const geoValue = ctx.geoActive
      ? geoScore({ ...geo, distKm: proximityKm, radiusKm: ctx.radiusKm })
      : undefined;

    const completeness = completenessScore({
      hasContact: !!(r.whatsapp || r.phone || r.instagram || r.website),
      hasSummary: !!r.summary,
      hasDescription: !!r.description,
      hasLocation: locId !== null,
      hasCoords: r.lat !== null,
      hasPrice: r.price_min !== null || r.price_max !== null,
      hasLinks: !!(r.instagram || r.website || r.maps_url),
      infoOnly: r.category_info_only === true
    });
    const { score, parts } = scoreOf({
      relevance: relevanceOf(catMatch, textRel),
      geo: geoValue,
      verification: verificationScore(verification),
      completeness,
      price: price ?? undefined
    });

    items.push({
      id: Number(r.id),
      slug: String(r.slug),
      name: String(r.name),
      summary: (r.summary as string | null) ?? null,
      category: r.category_slug
        ? { slug: String(r.category_slug), name: String(r.category_name), group }
        : null,
      location: r.location_name
        ? { name: String(r.location_name), parentName: (r.parent_name as string | null) ?? null }
        : null,
      distanceKm: distKm === null || ctx.origin?.from === 'induk' ? null : distKm,
      whatsapp: (r.whatsapp as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      instagram: (r.instagram as string | null) ?? null,
      website: (r.website as string | null) ?? null,
      mapsUrl: (r.maps_url as string | null) ?? null,
      photo: r.cover_photo ? photoUrl(String(r.cover_photo)) : null,
      priceMin: numOrNull(r.price_min),
      priceMax: numOrNull(r.price_max),
      priceUnit: (r.price_unit as string | null) ?? null,
      priceNote: (r.price_note as string | null) ?? null,
      verification,
      serviceModes: modes,
      attributes: (r.attributes as Record<string, unknown>) ?? {},
      score,
      parts,
      reasons: reasonsOf({
        catMatch,
        textRel,
        geo: { ...geo, distKm: ctx.origin?.from === 'induk' ? null : distKm },
        verification,
        completeness,
        priceScore: price
      })
    });
  }
  const verRank = (v: string) => verificationScore(v);
  items.sort(
    (a, b) =>
      b.score - a.score ||
      verRank(b.verification) - verRank(a.verification) ||
      (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) ||
      a.id - b.id
  );
  return { ctx, q, catIds, items, truncated };
}

export async function searchListings(params: SearchParams): Promise<SearchResult> {
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const offset = Math.max(params.offset ?? 0, 0);
  const main = await rank(params);

  const alternatives: SearchResult['alternatives'] = [];
  if (main.items.length < Math.max(limit, 3)) {
    const tries: { label: string; params: SearchParams }[] = [];
    if (main.ctx.origin && main.ctx.radiusKm < 100) {
      const wider = Math.min(100, main.ctx.radiusKm * 3);
      tries.push({
        label: `perluas radius jadi ${wider} km`,
        params: { ...params, radiusKm: wider }
      });
    }
    if (params.locationId !== undefined || params.near)
      tries.push({
        label: 'cari di seluruh Sumatera Barat',
        params: { ...params, locationId: undefined, near: undefined }
      });
    if (params.budget)
      tries.push({ label: 'abaikan batas anggaran', params: { ...params, budget: undefined } });
    if (params.minVerification)
      tries.push({
        label: 'abaikan syarat verifikasi',
        params: { ...params, minVerification: undefined }
      });
    if (params.serviceModes?.length)
      tries.push({
        label: 'abaikan syarat cara layanan',
        params: { ...params, serviceModes: undefined }
      });
    if (params.attributeFilters?.length)
      tries.push({
        label: 'abaikan syarat atribut (mis. kapasitas)',
        params: { ...params, attributeFilters: undefined }
      });
    for (const t of tries) {
      const n = (await rank(t.params)).items.length;
      if (n > main.items.length) alternatives.push({ label: t.label, count: n });
    }
    alternatives.sort((a, b) => b.count - a.count);
    alternatives.splice(3);
  }

  const L = main.ctx.location;
  return {
    items: main.items.slice(offset, offset + limit),
    total: main.items.length,
    truncated: main.truncated,
    applied: {
      q: main.q,
      categoryIds: main.catIds,
      location: L ? { id: L.id, name: L.name, level: L.level } : null,
      origin: main.ctx.origin?.from ?? null,
      radiusKm: main.ctx.radiusKm
    },
    alternatives
  };
}
