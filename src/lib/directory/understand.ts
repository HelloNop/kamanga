// Memahami kata warga memakai data kita sendiri (gazetteer lokasi, kamus istilah, nama kategori/kebutuhan).
// Dikerjakan KODE, bukan model: akurat, gratis, dan hasilnya bisa dijelaskan.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { norm } from './norm';
import { pgArray } from './sql';

export { norm };

/** Nama lokasi tanpa awalan "kota"/"kabupaten", mis. "kabupaten agam" -> "agam". */
export const bareNameSql = (col: unknown) =>
  sql`regexp_replace(${normSql(col)}, '^(kota|kabupaten) ', '')`;

// Tingkat lebih tinggi didahulukan bila nama yang sama dimiliki beberapa tingkat ("Payakumbuh" kota vs kelurahan).
const LEVEL_RANK_SQL = ['province', 'city', 'district', 'village', 'landmark'];
export const levelRank = (level: string) => LEVEL_RANK_SQL.indexOf(level);
export const keepTopLevel = <T extends Record<string, unknown>>(rows: T[]): T[] => {
  if (rows.length < 2) return rows;
  const best = Math.min(...rows.map((r) => levelRank(String(r.level))));
  const top = rows.filter((r) => levelRank(String(r.level)) === best);
  if (top.length > 1) return top; // beberapa di tingkat tertinggi yang sama: tetap ambigu di antara mereka
  if (best <= 1) return top; // provinsi/kota: nama besar, menang atas kelurahan/nagari bernama sama
  // Kecamatan menang hanya bila lokasi lain yang bernama sama adalah anaknya sendiri (kelurahan Kuranji di Kecamatan Kuranji).
  const t = top[0];
  const own = rows.every(
    (r) => r === t || (r.parent_name && norm(String(r.parent_name)) === norm(String(t.name)))
  );
  return own ? top : rows;
};

/** Padanan `norm` di dalam SQL. */
export const normSql = (col: unknown) =>
  sql`trim(regexp_replace(lower(unaccent(${col})), '[^a-z0-9]+', ' ', 'g'))`;

// Kata penunjuk tempat di awal ("di Lubeg", "sekitar Padang") tidak ikut dicocokkan.
const LOCATION_LEAD = /^(?:di|ke|dari|daerah|sekitar|dekat|area|wilayah|kawasan)\s+/;

export type LocationCandidate = {
  id: number;
  slug: string;
  name: string;
  level: string;
  parentName: string | null;
  score: number;
  matchedBy: string;
};
export type LocationResolution = {
  best: LocationCandidate | null;
  candidates: LocationCandidate[];
  ambiguous: boolean;
};

type Row = Record<string, unknown>;

export async function resolveLocation(text: string, limit = 5): Promise<LocationResolution> {
  const q = norm(text).replace(LOCATION_LEAD, '').trim();
  if (q.length < 2) return { best: null, candidates: [], ambiguous: false };
  const slugQ = q.replace(/ /g, '-');

  const toCandidate = (r: Row, matchedBy: string, score: number): LocationCandidate => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    level: String(r.level),
    parentName: (r.parent_name as string | null) ?? null,
    score,
    matchedBy
  });

  // 1) cocok persis: slug, nama, atau salah satu sebutan
  const exact = (
    await db.execute(sql`
    select l.id, l.slug, l.name, l.level, p.name as parent_name,
      case when l.slug = ${slugQ} then 'slug'
           when ${normSql(sql`l.name`)} = ${q} or ${bareNameSql(sql`l.name`)} = ${q} then 'nama'
           else (select 'sebutan "' || a.alias || '"' from location_aliases a where a.location_id = l.id and ${normSql(sql`a.alias`)} = ${q} limit 1) end as matched_by
    from locations l left join locations p on p.id = l.parent_id
    where l.slug = ${slugQ}
       or ${normSql(sql`l.name`)} = ${q}
       or ${bareNameSql(sql`l.name`)} = ${q}
       or exists (select 1 from location_aliases a where a.location_id = l.id and ${normSql(sql`a.alias`)} = ${q})
    order by array_position(array['province','city','district','village','landmark']::text[], l.level::text), l.name
    limit ${limit + 20}`)
  ).rows as Row[];
  if (exact.length) {
    const candidates = exact.slice(0, limit).map((r) => toCandidate(r, String(r.matched_by), 1));
    return {
      best: exact.length === 1 ? candidates[0] : null,
      candidates,
      ambiguous: exact.length > 1
    };
  }

  // 2) mirip (salah ketik): nama atau sebutan
  const fuzzy = (
    await db.execute(sql`
    select * from (
      select l.id, l.slug, l.name, l.level, p.name as parent_name,
        greatest(similarity(${normSql(sql`l.name`)}, ${q}),
                 coalesce((select max(similarity(${normSql(sql`a.alias`)}, ${q})) from location_aliases a where a.location_id = l.id), 0))::float8 as sim
      from locations l left join locations p on p.id = l.parent_id
    ) t where sim >= 0.45 order by sim desc, name limit ${limit}`)
  ).rows as Row[];
  const candidates = fuzzy.map((r) => toCandidate(r, 'mirip', Number(r.sim)));
  const [top, second] = candidates;
  const clear = !!top && top.score >= 0.6 && (!second || top.score - second.score >= 0.1);
  return { best: clear ? top : null, candidates, ambiguous: candidates.length > 0 && !clear };
}

export type CategoryMatch = {
  id: number;
  slug: string;
  name: string;
  group: string;
  /** Chatbot wajib menanyakan lokasi untuk kategori ini. */
  needsLocation: boolean;
  /** Listing kategori ini punya isian angka `capacity` (kapasitas orang), jadi bisa disaring menurut jumlah tamu. */
  hasCapacity: boolean;
  via: string;
  confidence: number;
};

const CAPACITY_SQL = sql`exists (select 1 from jsonb_array_elements(coalesce(c.attribute_schema, '[]'::jsonb)) a where a->>'key' = 'capacity')`;

const grams3 = (q: string) => {
  const words = q.split(' ');
  const grams = new Set<string>();
  for (let n = 1; n <= 3; n++)
    for (let i = 0; i + n <= words.length; i++) grams.add(words.slice(i, i + n).join(' '));
  return [...grams];
};

export type KamusHit = { term: string; meaning: string };

/** Kata di dalam kalimat yang ada di kamus. Hanya istilah yang sudah dicek penutur asli. */
export async function findKamusTerms(text: string): Promise<KamusHit[]> {
  const q = norm(text);
  if (q.length < 2) return [];
  const rows = (
    await db.execute(sql`
    select term, meaning from glossary_terms
    where is_checked and term = any(${pgArray(grams3(q), 'text')}) order by length(term) desc`)
  ).rows as Row[];
  return rows.map((r) => ({ term: String(r.term), meaning: String(r.meaning) }));
}

/** Kategori dari satu kalimat yang sudah diseragamkan: sebutan lain, kebutuhan, lalu nama kategori. */
async function matchCategories(q: string): Promise<CategoryMatch[]> {
  const grams = grams3(q);
  const found = new Map<number, CategoryMatch>();
  const add = (m: CategoryMatch) => {
    const prev = found.get(m.id);
    if (!prev || prev.confidence < m.confidence) found.set(m.id, m);
  };

  // 1) sebutan lain ("onda" -> Servis Motor; "baralek" -> kebutuhan Pesta Pernikahan -> banyak kategori)
  const aliasCats = (
    await db.execute(sql`
    select c.id, c.slug, c.name, (select gr.name from category_groups gr where gr.id = c.group_id) as cgroup, c.needs_location as cneeds, ${CAPACITY_SQL} as ccap,
           (select a from unnest(c.aliases) a where a = any(${pgArray(grams, 'text')}) limit 1) as term
    from categories c
    where c.is_active and c.aliases && ${pgArray(grams, 'text')}`)
  ).rows as Row[];
  for (const r of aliasCats)
    add({
      id: Number(r.id),
      slug: String(r.slug),
      name: String(r.name),
      group: String(r.cgroup),
      needsLocation: Boolean(r.cneeds),
      hasCapacity: Boolean(r.ccap),
      via: `sebutan "${r.term}"`,
      confidence: 1
    });
  const needIds = new Set<number>();
  const needVia = new Map<number, string>();
  const aliasNeeds = (
    await db.execute(sql`
    select n.id, n.name, (select a from unnest(n.aliases) a where a = any(${pgArray(grams, 'text')}) limit 1) as term
    from needs n
    where n.is_active and n.aliases && ${pgArray(grams, 'text')}`)
  ).rows as Row[];
  for (const r of aliasNeeds) {
    needIds.add(Number(r.id));
    needVia.set(Number(r.id), `sebutan "${r.term}" (kebutuhan ${r.name})`);
  }

  // 2) nama kebutuhan muncul di kalimat ("AC saya rusak" ~ "AC rusak")
  const nm = (
    await db.execute(sql`
    select n.id, n.name, word_similarity(${normSql(sql`n.name`)}, ${q})::float8 as ws
    from needs n where n.is_active and word_similarity(${normSql(sql`n.name`)}, ${q}) >= 0.75`)
  ).rows as Row[];
  for (const r of nm) {
    needIds.add(Number(r.id));
    needVia.set(Number(r.id), `kebutuhan "${r.name}"`);
  }

  if (needIds.size) {
    const cs = (
      await db.execute(sql`
      select nc.need_id, c.id, c.slug, c.name, (select gr.name from category_groups gr where gr.id = c.group_id) as cgroup, c.needs_location as cneeds, ${CAPACITY_SQL} as ccap from need_categories nc join categories c on c.id = nc.category_id and c.is_active
      where nc.need_id = any(${pgArray([...needIds], 'int')})`)
    ).rows as Row[];
    for (const r of cs)
      add({
        id: Number(r.id),
        slug: String(r.slug),
        name: String(r.name),
        group: String(r.cgroup),
        needsLocation: Boolean(r.cneeds),
        hasCapacity: Boolean(r.ccap),
        via: needVia.get(Number(r.need_id)) ?? 'kebutuhan',
        confidence: 0.85
      });
  }

  // 3) nama kategori muncul di kalimat ("servis ac cepat" ~ "Servis AC")
  const cn = (
    await db.execute(sql`
    select c.id, c.slug, c.name, (select gr.name from category_groups gr where gr.id = c.group_id) as cgroup, c.needs_location as cneeds, ${CAPACITY_SQL} as ccap, word_similarity(${normSql(sql`c.name`)}, ${q})::float8 as ws
    from categories c where c.is_active and word_similarity(${normSql(sql`c.name`)}, ${q}) >= 0.6`)
  ).rows as Row[];
  for (const r of cn)
    add({
      id: Number(r.id),
      slug: String(r.slug),
      name: String(r.name),
      group: String(r.cgroup),
      needsLocation: Boolean(r.cneeds),
      hasCapacity: Boolean(r.ccap),
      via: 'nama kategori',
      confidence: Number(r.ws)
    });

  // "tukang listrik" cocok dengan "Tukang" dan "Tukang Listrik": pertahankan yang lebih spesifik.
  const all = [...found.values()];
  const kept = all.filter(
    (c) =>
      c.via !== 'nama kategori' ||
      !all.some(
        (d) =>
          d !== c &&
          d.via === 'nama kategori' &&
          d.confidence >= c.confidence &&
          norm(d.name).length > norm(c.name).length &&
          norm(d.name).includes(norm(c.name))
      )
  );
  const bestByName = Math.max(
    0,
    ...kept.filter((c) => c.via === 'nama kategori').map((c) => c.confidence)
  );
  return kept
    .filter((c) => c.via !== 'nama kategori' || c.confidence >= bestByName - 0.2)
    .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}

/**
 * Kata -> kategori: sebutan lain (kategori dan kebutuhan), nama kebutuhan, nama kategori.
 * Kata yang ada di kamus diterjemahkan dulu ("baralek" -> "pesta pernikahan"), lalu dicocokkan lagi.
 */
export async function resolveCategories(text: string): Promise<CategoryMatch[]> {
  const q = norm(text);
  if (q.length < 2) return [];
  const direct = await matchCategories(q);
  const kamus = await findKamusTerms(text);
  if (!kamus.length) return direct;

  const translated = await matchCategories(norm(`${q} ${kamus.map((k) => k.meaning).join(' ')}`));
  const known = new Set(direct.map((c) => c.id));
  const via = `kamus "${kamus.map((k) => k.term).join('", "')}"`;
  const extra = translated.filter((c) => !known.has(c.id)).map((c) => ({ ...c, via }));
  return [...direct, ...extra].sort(
    (a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name)
  );
}

// ───────────────────────── lokasi di dalam kalimat bebas ─────────────────────────

const LOCATIVE = new Set([
  'di',
  'ke',
  'dari',
  'daerah',
  'sekitar',
  'sekitaran',
  'dekat',
  'area',
  'wilayah',
  'kawasan'
]);
// "masakan padang", "nasi padang": kata "padang" di sini jenis makanan, bukan tempat.
const FOOD_PREFIX = new Set(['masakan', 'nasi', 'sate', 'soto', 'rendang', 'ayam', 'mie', 'kapau']);

export type LocationInText = { resolution: LocationResolution; gram: string };

/** Mencari sebutan lokasi di dalam kalimat ("oto mogok di lubeg tolong"). Null bila tidak ada yang meyakinkan. */
export async function findLocationInText(text: string): Promise<LocationInText | null> {
  const q = norm(text);
  const w = q.split(' ').filter(Boolean);
  if (!w.length) return null;

  const grams: { gram: string; start: number; n: number }[] = [];
  for (let n = Math.min(4, w.length); n >= 1; n--) {
    for (let i = 0; i + n <= w.length; i++) {
      const gram = w.slice(i, i + n).join(' ');
      if (gram.length >= 3) grams.push({ gram, start: i, n });
    }
  }
  if (!grams.length) return null;

  const rows = (
    await db.execute(sql`
    select g.gram, l.id, l.slug, l.name, l.level::text as level, p.name as parent_name,
      case when l.slug = replace(g.gram, ' ', '-') then 'slug'
           when ${normSql(sql`l.name`)} = g.gram or ${bareNameSql(sql`l.name`)} = g.gram then 'nama'
           else (select 'sebutan "' || a.alias || '"' from location_aliases a where a.location_id = l.id and ${normSql(sql`a.alias`)} = g.gram limit 1) end as matched_by
    from locations l
    left join locations p on p.id = l.parent_id
    join unnest(${pgArray([...new Set(grams.map((g) => g.gram))], 'text')}) as g(gram) on (
      l.slug = replace(g.gram, ' ', '-')
      or ${normSql(sql`l.name`)} = g.gram
      or ${bareNameSql(sql`l.name`)} = g.gram
      or exists (select 1 from location_aliases a where a.location_id = l.id and ${normSql(sql`a.alias`)} = g.gram))`)
  ).rows as Row[];
  if (!rows.length) return null;

  const byGram = new Map<string, Row[]>();
  for (const r of rows) byGram.set(String(r.gram), [...(byGram.get(String(r.gram)) ?? []), r]);

  // Pilih gram terpanjang yang masuk akal sebagai lokasi.
  const scored = grams
    .filter((g) => byGram.has(g.gram))
    .map((g) => {
      const cands = byGram.get(g.gram)!;
      const locative = g.start > 0 && LOCATIVE.has(w[g.start - 1]);
      const food = g.start > 0 && FOOD_PREFIX.has(w[g.start - 1]);
      const villageOnly = cands.every((c) => c.level === 'village');
      const ok = !food && (locative || g.n >= 2 || (g.gram.length >= 4 && !villageOnly));
      return { ...g, cands, locative, ok };
    })
    .filter((g) => g.ok)
    .sort((a, b) => b.n - a.n || Number(b.locative) - Number(a.locative) || a.start - b.start);
  const pick = scored[0];
  if (!pick) return null;

  const seen = new Set<number>();
  let cands: Row[] = keepTopLevel<Row>(
    pick.cands.filter((r) => !seen.has(Number(r.id)) && seen.add(Number(r.id)))
  );
  if (cands.length > 1) {
    // "koto baru kubung": induk yang disebut di kalimat mempersempit pilihan
    // (sebutan lokasinya sendiri dibuang dulu, supaya induk bernama sama tidak ikut dianggap petunjuk)
    const rest = ` ${q} `.replace(` ${pick.gram} `, ' ');
    const hinted = cands.filter(
      (r) => r.parent_name && rest.includes(` ${norm(String(r.parent_name))} `)
    );
    if (hinted.length >= 1) cands = hinted;
  }
  const candidates = cands.slice(0, 5).map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    level: String(r.level),
    parentName: (r.parent_name as string | null) ?? null,
    score: 1,
    matchedBy: String(r.matched_by)
  }));
  return {
    gram: pick.gram,
    resolution: {
      best: candidates.length === 1 ? candidates[0] : null,
      candidates,
      ambiguous: candidates.length > 1
    }
  };
}
