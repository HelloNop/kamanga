// Router (PRD 8.2): pesan warga → NIAT TERSTRUKTUR (pintu, kategori, wilayah, waktu, jumlah orang, anggaran,
// syarat wajib, preferensi, rute) → langkah berikutnya. Urutan: template → aturan kode → model AI.
// Niat disimpan di chat_sessions.state, sehingga konteks terbawa dalam satu sesi: mengubah satu parameter
// mempertahankan yang lain, berganti kebutuhan mengganti niat (wilayah tetap).
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import {
  findLocationInText,
  norm,
  resolveCategories,
  type CategoryMatch
} from '@/lib/directory/understand';
import { pgArray } from '@/lib/directory/sql';
import { location, type Point, type Region } from '@/lib/engines/contracts';
import {
  extractBudget,
  extractCapacity,
  extractPeople,
  isGreeting,
  isJailbreak,
  isMenuRequest,
  isNo,
  isOutOfScope,
  isThanks,
  isYes,
  mergeWhen,
  parseWhen
} from './extract';
import * as replies from './replies';
import type { SearchArgs } from './search-tool';
import type { ChatAction, ChatState, Reply } from './types';

export type TurnCtx = {
  now: Date;
  /** Pemilih variasi balasan (jumlah pesan), agar hasil bisa diuji. */
  seed: number;
  /** Titik perangkat, hanya bersama aksi "Pakai lokasi saya". Dipakai untuk pencarian ini saja, tidak disimpan. */
  point?: Point | null;
  action?: ChatAction | null;
  /** Dipanggil dari tool model AI: jangan menjawab sapaan atau menyerahkan lagi ke model. */
  fromModel?: boolean;
};

export type Decision =
  | { kind: 'reply'; reply: Reply }
  /** Niat di state diteruskan ke findProviders (Mesin Jadwal + Lokasi). */
  | {
      kind: 'providers';
      origin: Point | null;
      scheduleKind: string;
      attributeLabels: Record<string, string>;
    }
  /** Jalur lama untuk kategori tanpa pintu aktif (Tempat, kategori tahap berikutnya). */
  | { kind: 'search'; args: SearchArgs; ctx: { budgetText?: string; capacityText?: string } }
  | { kind: 'focus'; listingId: number }
  | { kind: 'ask_provider'; listingId: number; question: string }
  | { kind: 'forward'; listingId: number; question: string }
  | { kind: 'llm' };

export type Routed = { decision: Decision; state: ChatState };

const CONFIDENT = 0.85;
const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
type Row = Record<string, unknown>;
const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];

// ───────────────────────── data acuan kecil (cache 5 menit) ─────────────────────────

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

type DoorRow = { slug: string; name: string; aliases: string[] };
const activeDoors = () =>
  cached('doors', () =>
    rows<DoorRow>(
      sql`select slug, name, aliases from doors where status = 'active' order by sort_order, id`
    )
  );
/** Tombol awal: nama pintu yang aktif (data, bisa diubah admin). */
export const doorChips = async () => (await activeDoors()).map((d) => d.name);

type CatMeta = {
  id: number;
  name: string;
  group: string;
  needsLocation: boolean;
  scheduleKind: string;
  doorSlug: string | null;
  doorName: string | null;
  doorActive: boolean;
  attributeSchema: unknown;
};
async function catMeta(ids: number[]): Promise<CatMeta[]> {
  if (!ids.length) return [];
  const r = await rows<Row>(sql`
    select c.id, c.name, g.name as grp, c.needs_location, c.schedule_kind::text as schedule_kind,
           c.attribute_schema, d.slug as door_slug, d.name as door_name, d.status::text as door_status
    from categories c
    left join category_groups g on g.id = c.group_id
    left join doors d on d.id = c.door_id
    where c.id = any(${pgArray(ids, 'int')}) and c.is_active`);
  const byId = new Map(
    r.map((x) => [
      Number(x.id),
      {
        id: Number(x.id),
        name: String(x.name),
        group: String(x.grp ?? ''),
        needsLocation: Boolean(x.needs_location),
        scheduleKind: String(x.schedule_kind),
        doorSlug: (x.door_slug as string | null) ?? null,
        doorName: (x.door_name as string | null) ?? null,
        doorActive: x.door_status === 'active',
        attributeSchema: x.attribute_schema
      }
    ])
  );
  return ids.map((id) => byId.get(id)).filter((m): m is CatMeta => !!m);
}

// ponytail: "padel", "futsal", "badminton" tidak dikenali resolveCategories karena nama kategorinya "Lapangan X"
// dan sebutan lainnya kosong. Hapus setelah sebutan lain kategori olahraga ditambahkan di data acuan (diminta ke lead).
const sportNames = () =>
  cached('sport', async () =>
    (
      await rows<{ id: number; name: string }>(
        sql`select id, name from categories where is_active and name ilike 'Lapangan %'`
      )
    )
      .map((r) => ({ id: Number(r.id), name: r.name, q: norm(r.name).replace(/^lapangan /, '') }))
      .filter((r) => r.q !== 'olahraga lain')
  );

async function recognizeCategories(text: string): Promise<{ id: number; name: string }[]> {
  const found: CategoryMatch[] = (await resolveCategories(text)).filter(
    (c) => c.confidence >= CONFIDENT
  );
  if (found.length) return found.map((c) => ({ id: c.id, name: c.name }));
  const t = ` ${norm(text)} `;
  return (await sportNames()).filter((s) => t.includes(` ${s.q} `));
}

/** Pintu dari nama atau sebutan lainnya ("sewa lapangan" → Ka main). */
async function recognizeDoor(text: string) {
  const t = ` ${norm(text)} `;
  const d = (await activeDoors()).find(
    (x) => t.includes(` ${norm(x.name)} `) || x.aliases.some((a) => t.includes(` ${a} `))
  );
  return d ? { slug: d.slug, name: d.name } : null;
}

/** Kategori sebuah pintu yang sudah punya penyedia terbit (tombol "jenisnya apa"). */
const doorCategories = (slug: string) =>
  cached(`door:${slug}`, async () =>
    (
      await rows<{ id: number; name: string }>(sql`
        select c.id, c.name from categories c join doors d on d.id = c.door_id
        where d.slug = ${slug} and c.is_active and exists (
          select 1 from listing_categories lc join listings l on l.id = lc.listing_id
          where lc.category_id = c.id and l.status = 'published')
        order by c.sort_order, c.name`)
    ).map((r) => ({ id: Number(r.id), name: r.name }))
  );

/** Nama kategori yang sudah punya listing terbit di tempat itu (termasuk bawahannya), terbanyak dulu. */
async function categoriesAt(locationId: number, limit = 5): Promise<string[]> {
  const r = await rows<{ name: string }>(sql`
    with recursive sub as (
      select id from locations where id = ${locationId}
      union all
      select l.id from locations l join sub on l.parent_id = sub.id
    )
    select c.name, count(distinct l.id)::int as n
    from listings l
    join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    join categories c on c.id = lc.category_id and c.is_active
    where l.status = 'published'
      and (l.location_id in (select id from sub)
           or exists (select 1 from listing_areas la
                      where la.listing_id = l.id and la.location_id in (select id from sub)))
    group by c.name
    order by n desc, c.name
    limit ${limit}`);
  return r.map((x) => x.name);
}

/** Tujuan travel yang punya keberangkatan terbit. */
const destinations = () =>
  cached('dest', async () =>
    (
      await rows<{ name: string }>(sql`
        select distinct d.name from units u
        join listings l on l.id = u.listing_id and l.status = 'published'
        join locations d on d.id = u.destination_location_id
        where u.is_active order by d.name limit 6`)
    ).map((r) => r.name.replace(/^(Kota|Kabupaten) /, ''))
  );

const regionLabel = (r: Region) =>
  r.level === 'city' || r.level === 'province' || !r.parentName
    ? r.name
    : `${r.name}, ${r.parentName.replace(/^(Kota|Kabupaten) /, '')}`;

async function regionById(id: number): Promise<{ id: number; label: string } | null> {
  const [r] = await rows<{ id: number; name: string; level: string; parent: string | null }>(sql`
    select l.id, l.name, l.level::text as level, p.name as parent
    from locations l left join locations p on p.id = l.parent_id where l.id = ${id}`);
  if (!r) return null;
  return {
    id: Number(r.id),
    label: regionLabel({
      id: Number(r.id),
      name: r.name,
      level: r.level as Region['level'],
      parentName: r.parent,
      center: null
    })
  };
}

// ───────────────────────── membaca satu pesan ─────────────────────────

type Place =
  | { kind: 'resolved'; id: number; label: string }
  | { kind: 'ambiguous'; options: Region[] }
  /** explicit: disebut setelah kata penunjuk tempat ("di jakarta"). */
  | { kind: 'unknown'; said: string; explicit: boolean };

/** Nama daerah di dalam kalimat → wilayah lewat Mesin Lokasi ("Koto Baru" → Koto Baru Nan XX di Padang). */
async function findPlace(
  text: string,
  s: ChatState,
  wholeMessage: boolean
): Promise<{ place: Place | null; gram?: string }> {
  const inText = await findLocationInText(text);
  let gram = inText?.gram;
  let explicit = false;
  if (!gram && wholeMessage) gram = text;
  if (!gram) {
    // "di padanng": kata setelah penunjuk tempat yang tidak dikenali persis (mungkin salah ketik atau di luar Sumbar)
    const said = norm(text).match(/\b(?:di|daerah|sekitar|dekat|dakek)\s+((?:[a-z0-9]+\s?){1,3})$/);
    if (!said) return { place: null };
    gram = said[1].trim();
    explicit = true;
  }
  const r = await location.resolvePlaceName(gram, { lastLocationId: s.region?.id });
  if (r.kind === 'resolved')
    return { place: { kind: 'resolved', id: r.region.id, label: regionLabel(r.region) }, gram };
  if (r.kind === 'ambiguous' && !explicit && !wholeMessage)
    return { place: { kind: 'ambiguous', options: r.options }, gram };
  const best = inText?.resolution.best;
  if (best) {
    const reg = await regionById(best.id);
    if (reg) return { place: { kind: 'resolved', ...reg }, gram };
  }
  if (r.kind === 'ambiguous') return { place: { kind: 'ambiguous', options: r.options }, gram };
  return { place: { kind: 'unknown', said: gram, explicit }, gram };
}

// Kata yang bukan kebutuhan: pengantar, penunjuk tempat, waktu, jumlah, anggaran, sapaan.
const FILLER = new Set(
  (
    'tolong carikan cari carikanlah cariin mau ingin butuh perlu cariken ada adakah yang di ke dari daerah ' +
    'sekitar dekat dakek dong ya nih aja saja sajo untuk buat dan atau apa apakah kak uda uni pak bu bisa bisakah ' +
    'saya aku kami kita sih deh lah juga lagi besok hari ini itu nan ado untuak tolongin bantu kalau kalo klo ' +
    'anggaran budget maksimal max sampai kurang juta ribu rb jt rupiah rp orang org urang tamu per pax ' +
    'murah mahal bagus terbaik terdekat lain lainnya sama mana dimana yg sekarang nanti ntar kini isuak lusa ' +
    'jam pukul pagi siang sore malam malem petang senin selasa rabu kamis jumat sabtu minggu ahad tanggal tgl ' +
    'kosong masih coba gimana gmn baa ko kok sendiri berdua baduo bertiga batigo berempat barampek berlima balimo ' +
    'kapan terserah bebas boleh oke ok jadi'
  ).split(' ')
);
/** Jumlah kata bermakna yang tersisa setelah nama tempat, kata pengantar, waktu, dan angka dibuang. */
function leftoverWords(text: string, locGram?: string) {
  const loc = new Set(norm(locGram ?? '').split(/\s+/));
  return norm(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d/.test(w) && !FILLER.has(w) && !loc.has(w)).length;
}

const sameIds = (a: { id: number }[], b?: { id: number }[]) =>
  !!b && a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));

const looksLikeQuestion = (text: string) =>
  /\?\s*$/.test(text) ||
  /^(apa|apakah|ada|ado|bisa|boleh|berapa|kapan|termasuk|wajib|harus|gimana|bagaimana|baa)\b/.test(
    norm(text)
  );

/** Penyedia yang terakhir ditampilkan yang namanya disebut di pesan. */
function mentioned(text: string, s: ChatState) {
  const t = ` ${norm(text)} `;
  return s.shown?.find((l) => {
    const n = norm(l.name).replace(/^dummy /, '');
    return n.length >= 4 && t.includes(` ${n} `);
  });
}

type AttrDef = ReturnType<typeof parseAttributeSchema>[number];
const attrDefs = (meta: CatMeta[]): AttrDef[] =>
  meta.flatMap((m) => parseAttributeSchema(m.attributeSchema));

/** Isian ya/tidak yang diminta sebagai syarat ("padel yang termasuk raket") → syarat wajib. Pertanyaan biasa
 *  ("wajib dp?") bukan syarat: itu pertanyaan tentang penyedia. */
function booleanFilters(text: string, defs: AttrDef[]) {
  const t = ` ${norm(text)} `;
  return Object.fromEntries(
    defs
      .filter(
        (d) =>
          d.type === 'boolean' &&
          new RegExp(` (yang|yg|nan|dengan|sudah) ${norm(d.label)} `).test(t)
      )
      .map((d) => [d.key, true])
  ) as Record<string, boolean>;
}

/** Pertanyaan yang menyentuh isian aturan kategori ini (label atau pilihannya). */
function touchesRules(text: string, defs: AttrDef[]) {
  const q = norm(text)
    .split(' ')
    .filter((w) => w.length >= 3);
  return defs.some((d) =>
    norm([d.label, ...(d.options ?? [])].join(' '))
      .split(' ')
      .some((w) => w.length >= 3 && q.some((x) => x === w || (x.length >= 4 && w.includes(x))))
  );
}

const bare = (n: string) => n.replace(/^(Kota|Kabupaten) /, '');
async function resolveRegion(name?: string) {
  if (!name) return null;
  const r = await location.resolvePlaceName(name);
  return r.kind === 'resolved' ? { id: r.region.id, name: r.region.name } : null;
}

/** "travel dari Padang ke Bukittinggi": asal dan tujuan. Asal bawaan: kota layanan (Padang). */
async function parseRoute(text: string, s: ChatState): Promise<ChatState['route'] | undefined> {
  const t = ` ${norm(text)} `;
  const part = (kw: string) =>
    t.match(
      new RegExp(
        ` ${kw} ([a-z0-9]+(?: [a-z0-9]+){0,2}?)(?= (?:dari|ke|besok|lusa|nanti|jam|pukul|pagi|siang|sore|malam|untuk|hari|tanggal|tgl|\\d)|\\s*$)`
      )
    )?.[1];
  const [to, from] = await Promise.all([resolveRegion(part('ke')), resolveRegion(part('dari'))]);
  if (!to && !from) return undefined;
  let origin = from ?? (s.route ? { id: s.route.fromId, name: s.route.fromName } : null);
  if (!origin) {
    const [city] = await location.serviceRegionIds();
    const reg = city ? await regionById(city) : null;
    origin = reg ? { id: reg.id, name: reg.label } : null;
  }
  const dest = to ?? (s.route ? { id: s.route.toId, name: s.route.toName } : null);
  if (!origin || !dest) return undefined;
  return { fromId: origin.id, fromName: bare(origin.name), toId: dest.id, toName: bare(dest.name) };
}

// ───────────────────────── memutuskan ─────────────────────────

/** Niat baru saat berganti kebutuhan: wilayah tetap, sisanya diganti (anggaran per porsi tidak terbawa). */
const fresh = (s: ChatState): ChatState => ({ region: s.region ?? null });

/**
 * Satu pesan → keputusan + niat baru. Tidak menulis apa pun ke database.
 * @param prev niat sesi sebelumnya (chat_sessions.state)
 */
export async function decide(text: string, prev: ChatState, ctx: TurnCtx): Promise<Routed> {
  let s: ChatState = { ...prev };
  const clean = text.trim();
  const chips = await doorChips();
  const reply = (r: Reply, patch: Partial<ChatState> = {}): Routed => ({
    decision: { kind: 'reply', reply: r },
    state: { ...s, ...patch }
  });
  const llm = (needUnknown = false): Routed => ({
    decision: { kind: 'llm' },
    state: { ...s, needUnknown }
  });

  if (ctx.action) {
    const r = await onAction(ctx.action, s, ctx);
    if (r) return r;
  }
  if (!clean) return reply(replies.unclear(chips));
  if (isJailbreak(clean)) return reply(replies.outOfScope(chips));

  // Jawaban atas tawaran "Mau ditanyakan ke pengelolanya?"
  if (s.pending?.kind === 'forward') {
    const p = s.pending;
    s = { ...s, pending: null };
    if (isYes(clean))
      return {
        decision: { kind: 'forward', listingId: p.listingId, question: p.question },
        state: s
      };
    if (isNo(clean)) return reply(replies.forwardCancelled());
  }
  if (!ctx.fromModel) {
    if (isGreeting(clean)) return reply(replies.greeting(ctx.seed, chips));
    if (isThanks(clean)) return reply(replies.thanks(ctx.seed));
    if (isMenuRequest(clean)) return reply(replies.menu(chips));
  }
  const t = norm(clean);
  if (/^(ganti|ubah|pindah) (lokasi|daerah|tempat)\b/.test(t))
    return reply(replies.askLocation(), { region: null, asked: 'location' });
  // Penjelasan atau perbandingan: bukan pencarian, diserahkan ke model AI.
  if (
    !ctx.fromModel &&
    (/\b(bedanya|perbedaan|bandingkan|dibanding|kenapa|mengapa)\b/.test(t) ||
      /^(bagaimana|gimana) cara\b/.test(t))
  )
    return llm();

  const cats = await recognizeCategories(clean);
  const door = cats.length ? null : await recognizeDoor(clean);
  if (!cats.length && !door && isOutOfScope(clean)) return reply(replies.outOfScope(chips));

  const when = parseWhen(clean, ctx.now);
  const people = extractPeople(clean);
  const budget = extractBudget(clean);
  const capacity = extractCapacity(clean);
  const nothingElse =
    !cats.length && !door && !when && !people && !budget && capacity === undefined;
  const short = clean.split(/\s+/).length <= 3;
  const { place, gram } = await findPlace(clean, s, nothingElse && short);
  const resolved = place?.kind === 'resolved' ? place : null;

  // Pertanyaan tentang satu penyedia: yang disebut namanya, atau yang dipilih lewat tombol "Tanya".
  // Fokus dari tombol hanya berlaku untuk kalimat tanya yang tidak mencari tempat lain ("ado lai?", "yang lain").
  const named = mentioned(clean, s);
  const aboutOther = /\b(lain|lainnya|selain|lai|lagi|cari|carikan)\b/.test(t);
  const target =
    named ?? (s.focus && looksLikeQuestion(clean) && !aboutOther ? s.focus : null) ?? null;
  if (target && !cats.length && !door && !resolved && !when && !people && !budget)
    return {
      decision: { kind: 'ask_provider', listingId: target.id, question: clean },
      state: { ...s, focus: target }
    };
  // Pertanyaan aturan setelah daftar tampil, tanpa memilih tempat.
  if (!target && s.shown?.length && nothingElse && !resolved && s.categories?.length) {
    const defs = attrDefs(await catMeta(s.categories.map((c) => c.id)));
    const filters = booleanFilters(clean, defs);
    if (Object.keys(filters).length) {
      s = { ...s, attributes: { ...s.attributes, ...filters } };
      return dispatch(s, ctx, { clean, place: null });
    }
    if (looksLikeQuestion(clean) && touchesRules(clean, defs)) {
      if (s.shown.length === 1)
        return {
          decision: { kind: 'ask_provider', listingId: s.shown[0].id, question: clean },
          state: { ...s, focus: s.shown[0] }
        };
      return reply(replies.whichListing(s.shown.slice(0, 5)), {
        pending: { kind: 'which', question: clean }
      });
    }
  }

  if (!cats.length && !door) {
    const hasContext = !!(s.categories?.length || s.door);
    if (!hasContext) {
      if (place?.kind === 'ambiguous') return reply(replies.chooseLocation(place.options));
      if (resolved) {
        // Kebutuhan disebut di pesan sebelumnya (tak dikenal kode), sekarang hanya menjawab lokasi: ke model AI.
        if (s.needUnknown || leftoverWords(clean, gram) >= 1) return llm(true);
        s = { ...s, region: { id: resolved.id, label: resolved.label, source: 'typed' } };
        return reply(replies.askCategory(resolved.label, await categoriesAt(resolved.id), chips), {
          asked: 'category'
        });
      }
      if (s.asked === 'location' && short && place?.kind === 'unknown')
        return reply(replies.unknownLocation(clean, []));
      return llm(true);
    }
    // Lanjutan dengan konteks, tetapi tidak ada yang bisa dipakai: model AI (atau tempat di luar Sumbar).
    const named = place && (place.kind !== 'unknown' || place.explicit);
    if (nothingElse && !named) {
      if (s.asked === 'location' && short) return reply(replies.unknownLocation(clean, []));
      return llm();
    }
    // Ada kata kebutuhan yang tidak dikenal kode: model AI, bukan niat lama.
    if (leftoverWords(clean, gram) >= 1) return llm(true);
  }

  // Menggabungkan niat
  const topicChange =
    (cats.length && !sameIds(cats, s.categories)) || (!!door && door.slug !== s.door?.slug);
  if (topicChange) s = fresh(s);
  s = { ...s, needUnknown: false, pending: null };
  if (topicChange) s.focus = null;
  if (cats.length) s.categories = cats;
  if (door) s.door = door;
  if (resolved) s.region = { id: resolved.id, label: resolved.label, source: 'typed' };
  if (when) s.when = mergeWhen(s.when, when, ctx.now);
  if (people) s.people = people;
  if (budget) s.budget = budget;
  if (capacity !== undefined) s.capacity = capacity;
  if (/\b(panggilan|ke rumah|datang ke)\b/.test(t)) s.prefer = 'call';
  const onlyWhen = !cats.length && !door && !!when && !resolved && !people && !budget;
  return dispatch(s, ctx, { clean, place, onlyWhen, prevRegion: prev.region ?? null });
}

/**
 * Niat sudah digabung: tanyakan SATU hal yang masih kurang (dengan tombol), atau teruskan ke mesin.
 * Urutan tanya (PRD 9.1): jenis → waktu (ber-jadwal) → lokasi. Travel: tujuan → waktu → jumlah orang.
 */
async function dispatch(
  s: ChatState,
  ctx: TurnCtx,
  info: {
    clean: string;
    place: Place | null;
    onlyWhen?: boolean;
    /** Wilayah sebelum pesan ini: nama kota di "travel ke Bukittinggi" adalah tujuan, bukan lokasi warga. */
    prevRegion?: ChatState['region'];
  }
): Promise<Routed> {
  const reply = (r: Reply, patch: Partial<ChatState> = {}): Routed => ({
    decision: { kind: 'reply', reply: r },
    state: { ...s, ...patch }
  });
  if (info.place?.kind === 'ambiguous') return reply(replies.chooseLocation(info.place.options));
  if (!s.categories?.length) {
    if (s.door)
      return reply(replies.askDoorCategory(s.door, await doorCategories(s.door.slug)), {
        asked: 'category'
      });
    if (s.region)
      return reply(
        replies.askCategory(s.region.label, await categoriesAt(s.region.id), await doorChips()),
        { asked: 'category' }
      );
    return { decision: { kind: 'llm' }, state: s };
  }

  const meta = await catMeta(s.categories.map((c) => c.id));
  const defs = attrDefs(meta);
  const filters = booleanFilters(info.clean, defs);
  if (Object.keys(filters).length) s = { ...s, attributes: { ...s.attributes, ...filters } };
  const needsLocation = meta.some((m) => m.needsLocation);
  if (info.place?.kind === 'unknown' && info.place.explicit && needsLocation)
    return reply(replies.unknownLocation(info.place.said, []));

  const engine = meta.filter((m) => m.doorActive);
  if (engine.length) {
    const first = engine[0];
    s = {
      ...s,
      categories: engine.map((m) => ({ id: m.id, name: m.name })),
      door: { slug: first.doorSlug!, name: first.doorName! }
    };
    const kind = first.scheduleKind;
    const timed = kind === 'slot' || kind === 'seat';
    // "ada yang buka malam ini?" untuk kategori tanpa jadwal: jam buka, bukan slot → model AI.
    if (info.onlyWhen && !timed && !ctx.fromModel) return { decision: { kind: 'llm' }, state: s };
    if (kind === 'seat') {
      const route = await parseRoute(info.clean, s);
      if (route) s = { ...s, route, region: info.prevRegion ?? null };
      if (!s.route)
        return reply(replies.askDestination(await destinations()), { asked: 'destination' });
      if (!s.when) return reply(replies.askWhen(true), { asked: 'when' });
      if (!s.people) return reply(replies.askPeople(), { asked: 'people' });
    } else {
      if (timed && !s.when) return reply(replies.askWhen(false), { asked: 'when' });
      if (needsLocation && !s.region && !ctx.point)
        return reply(replies.askLocation(), { asked: 'location' });
    }
    return {
      decision: {
        kind: 'providers',
        origin: ctx.point ?? null,
        scheduleKind: kind,
        attributeLabels: Object.fromEntries(defs.map((d) => [d.key, d.label]))
      },
      state: { ...s, asked: null, focus: null }
    };
  }

  // Jalur lama: kategori tanpa pintu aktif (Tempat, Katering, Gedung, ...) lewat searchListings.
  if (needsLocation && !s.region) return reply(replies.askLocation(), { asked: 'location' });
  const names = meta.map((m) => m.name);
  const venue = defs.some((d) => d.key === 'capacity');
  return {
    decision: {
      kind: 'search',
      args: {
        query: names.join(' '),
        categoryIds: meta.map((m) => m.id),
        locationId: s.region?.id,
        budget: s.budget ? { max: s.budget.max, unit: s.budget.unit } : undefined,
        minCapacity: venue ? (s.capacity ?? undefined) : undefined,
        limit: 5,
        labels: { names, groups: [...new Set(meta.map((m) => m.group))] }
      },
      ctx: {
        budgetText: s.budget
          ? `anggaran sampai ${rupiah(s.budget.max)}${s.budget.unit === 'per_person' ? ' per orang' : ''}`
          : undefined,
        capacityText: venue && s.capacity ? `untuk ${s.capacity} orang` : undefined
      }
    },
    state: { ...s, asked: null, focus: null }
  };
}

/** Tombol yang membawa aksi terstruktur. null = abaikan aksinya dan baca teksnya saja. */
async function onAction(a: ChatAction, s: ChatState, ctx: TurnCtx): Promise<Routed | null> {
  const reply = (r: Reply, patch: Partial<ChatState> = {}): Routed => ({
    decision: { kind: 'reply', reply: r },
    state: { ...s, ...patch }
  });
  const base = { clean: '', place: null };
  switch (a.kind) {
    case 'category': {
      const [m] = await catMeta([a.id]);
      if (!m) return null;
      const keep = sameIds([m], s.categories) ? s : fresh(s);
      return dispatch({ ...keep, categories: [{ id: m.id, name: m.name }] }, ctx, base);
    }
    case 'region': {
      const r = await regionById(a.id);
      if (!r) return null;
      return dispatch({ ...s, region: { ...r, source: 'typed' } }, ctx, base);
    }
    case 'relax': {
      if (!s.categories?.length) return null;
      const next: ChatState = { ...s };
      if (a.key === 'radius') next.radiusKm = (s.radiusKm ?? 15) * 3;
      if (a.key === 'budget') next.budget = null;
      if (a.key === 'attributes') next.attributes = {};
      if (a.key === 'time' && s.when)
        next.when = { date: s.when.date, from: '00:00', to: '24:00', days: 1 };
      return dispatch(next, ctx, base);
    }
    case 'focus': {
      const [l] = await rows<{ id: number; slug: string; name: string }>(
        sql`select id, slug, name from listings where slug = ${a.slug} and status = 'published'`
      );
      if (!l) return null;
      const focus = { id: Number(l.id), slug: l.slug, name: l.name };
      if (s.pending?.kind === 'which')
        return {
          decision: { kind: 'ask_provider', listingId: focus.id, question: s.pending.question },
          state: { ...s, focus, pending: null }
        };
      return { decision: { kind: 'focus', listingId: focus.id }, state: { ...s, focus } };
    }
    case 'forward': {
      const p = s.pending?.kind === 'forward' ? s.pending : null;
      if (!p || !a.yes) return reply(replies.forwardCancelled(), { pending: null });
      return {
        decision: { kind: 'forward', listingId: p.listingId, question: p.question },
        state: { ...s, pending: null }
      };
    }
    case 'location': {
      if (!ctx.point) return reply(replies.askLocation(), { asked: 'location' });
      const r = await location.resolvePoint(ctx.point);
      const reg = r?.village ?? r?.district ?? r?.city;
      if (!r || !r.inServiceRegion || !reg)
        return reply(replies.outsideService(), { asked: 'location' });
      return dispatch(
        { ...s, region: { id: reg.id, label: r.label, source: 'device' } },
        ctx,
        base
      );
    }
  }
}
