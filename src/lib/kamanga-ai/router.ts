// Router: memutuskan apakah sebuah pesan cukup dikerjakan KODE (gratis), atau perlu model AI.
// Jalur kode menangani kalimat yang jelas (kategori + lokasi, sapaan, tanya balik lokasi). Sisanya ke model AI.
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  findLocationInText,
  norm,
  resolveCategories,
  resolveLocation,
  type CategoryMatch,
  type LocationInText
} from '@/lib/directory/understand';
import {
  extractBudget,
  extractCapacity,
  isGreeting,
  isMenuRequest,
  isThanks,
  type Budget
} from './extract';
import * as replies from './replies';
import type { SearchArgs } from './search-tool';
import type { Reply } from './types';

export type Decision =
  | { kind: 'reply'; reply: Reply }
  | { kind: 'search'; args: SearchArgs; ctx: { budgetText?: string; capacityText?: string } }
  | { kind: 'llm' };

const CONFIDENT = 0.85;
const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
const CITY_CHIPS = ['di Padang', 'di Bukittinggi', 'di Payakumbuh', 'di Sumbar'];

let needCache: { at: number; names: string[] } | null = null;
async function needChips(): Promise<string[]> {
  if (needCache && Date.now() - needCache.at < 5 * 60_000) return needCache.names;
  const rows = (
    await db.execute(sql`select name from needs where is_active order by sort_order, id limit 6`)
  ).rows as { name: string }[];
  needCache = { at: Date.now(), names: rows.map((r) => r.name) };
  return needCache.names;
}

// Kata yang tidak menyebut kebutuhan: pengantar, penunjuk tempat, angka dan satuan anggaran.
const FILLER = new Set(
  (
    'tolong carikan cari carikanlah cariin mau ingin butuh perlu cariken ada adakah yang di ke dari daerah ' +
    'sekitar dekat dong ya nih aja saja untuk buat dan atau apa apakah kak uda uni pak bu bisa bisakah ' +
    'saya aku kami kita sih deh lah juga lagi besok hari ini itu nan ado untuak tolongin bantu ' +
    'anggaran budget maksimal max sampai kurang juta ribu rb jt rupiah rp orang tamu per ' +
    'murah mahal bagus terbaik terdekat lain lainnya sama mana dimana yg sekarang nanti'
  ).split(' ')
);

/** Jumlah kata bermakna yang tersisa setelah nama tempat, kata pengantar, dan angka dibuang. */
function leftoverWords(text: string, locGram?: string) {
  const loc = new Set(norm(locGram ?? '').split(/\s+/));
  return norm(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^\d/.test(w) && !FILLER.has(w) && !loc.has(w)).length;
}

/** Nama kategori yang sudah punya listing terbit di tempat itu (termasuk bawahannya), terbanyak dulu. */
async function categoriesAt(locationId: number, limit = 5): Promise<string[]> {
  const rows = (
    await db.execute(sql`
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
      limit ${limit}`)
  ).rows as { name: string }[];
  return rows.map((r) => r.name);
}

type Analysis = {
  cats: CategoryMatch[];
  loc: LocationInText | null;
  budget?: Budget;
  capacity?: number;
};

async function analyze(text: string): Promise<Analysis> {
  const cats = (await resolveCategories(text)).filter((c) => c.confidence >= CONFIDENT);
  let loc = await findLocationInText(text);
  // pesan pendek yang hanya berisi nama tempat ("lubeg", "aia pacah")
  if (!loc && !cats.length && text.trim().split(/\s+/).length <= 3) {
    const r = await resolveLocation(text);
    if (r.best || r.ambiguous) loc = { resolution: r, gram: text };
  }
  return { cats, loc, budget: extractBudget(text), capacity: extractCapacity(text) };
}

/**
 * Balasan kode untuk pesan yang pasti aman dijawab tanpa konteks: kosong, sapaan murni, terima kasih, atau
 * permintaan menu. Dipakai pada mode AI-first; selain ini semua pesan diserahkan ke model AI.
 */
export async function quickReply(text: string, seed: number): Promise<Reply | null> {
  const clean = text.trim();
  const chips = await needChips();
  if (!clean) return replies.unclear(chips);
  const n = clean.split(/\s+/).length;
  if (isGreeting(clean)) return replies.greeting(seed, chips);
  // pendek saja: "oke makasih, sekarang cari katering" bukan sekadar terima kasih
  if (n <= 3 && isThanks(clean)) return replies.thanks(seed);
  if (n <= 4 && isMenuRequest(clean)) return replies.menu(chips);
  return null;
}

/**
 * @param text pesan terbaru
 * @param previousUserTexts pesan pengguna sebelumnya di sesi yang sama (lama -> baru)
 * @param seed pemilih variasi balasan (jumlah pesan), agar hasil bisa diuji
 * @param opts.awaitingLocation balasan bot sebelumnya menanyakan lokasi (maka jawaban pendek yang tak dikenali = tempat di luar Sumbar)
 */
export async function decide(
  text: string,
  previousUserTexts: string[],
  seed: number,
  opts: { awaitingLocation?: boolean } = {}
): Promise<Decision> {
  const clean = text.trim();
  const chips = await needChips();
  if (!clean) return { kind: 'reply', reply: replies.unclear(chips) };
  // Pertanyaan yang meminta penjelasan/perbandingan (bukan mencari usaha) dijawab model AI, bukan ditebak sebagai pencarian.
  if (
    /^(?:apa|apakah|kenapa|mengapa|bagaimana|gimana|berapa|kapan|siapa)\b/i.test(clean) &&
    clean.split(/\s+/).length >= 4
  )
    return { kind: 'llm' };
  if (/\b(?:bedanya|perbedaan|bandingkan|dibanding)\b/i.test(clean)) return { kind: 'llm' };
  if (isGreeting(clean)) return { kind: 'reply', reply: replies.greeting(seed, chips) };
  if (isThanks(clean)) return { kind: 'reply', reply: replies.thanks(seed) };
  if (isMenuRequest(clean)) return { kind: 'reply', reply: replies.menu(chips) };

  // Slot dikumpulkan dari pesan sebelumnya (lokasi tetap berlaku; anggaran/kapasitas hilang bila kategori berganti).
  let cats: CategoryMatch[] = [];
  let catsText = '';
  let location: { id: number; name: string } | null = null;
  let budget: Budget | undefined;
  let capacity: number | undefined;
  for (const t of previousUserTexts.slice(-3)) {
    const a = await analyze(t);
    if (a.cats.length) {
      cats = a.cats;
      catsText = t;
      budget = undefined;
      capacity = undefined;
    }
    if (a.loc?.resolution.best)
      location = { id: a.loc.resolution.best.id, name: a.loc.resolution.best.name };
    budget = a.budget ?? budget;
    capacity = a.capacity ?? capacity;
  }
  const cur = await analyze(clean);
  if (cur.cats.length) {
    cats = cur.cats;
    catsText = clean;
    budget = undefined;
    capacity = undefined;
  }
  if (cur.loc?.resolution.best)
    location = { id: cur.loc.resolution.best.id, name: cur.loc.resolution.best.name };
  budget = cur.budget ?? budget;
  capacity = cur.capacity ?? capacity;

  // nama tempat yang bisa berarti banyak tempat: tanyakan dulu
  if (cur.loc?.resolution.ambiguous)
    return { kind: 'reply', reply: replies.chooseLocation(cur.loc.resolution.candidates) };

  const recognized = cur.cats.length > 0 || !!cur.loc || !!cur.budget || cur.capacity !== undefined;
  const shortMessage = clean.split(/\s+/).length <= 4;

  // Pesan ini tidak memberi informasi baru. Slot lama hanya dipakai untuk melengkapi jawaban, bukan untuk menebak topik.
  // Pengecualian: bot baru saja menanyakan lokasi dan jawabannya pendek -> kemungkinan nama tempat di luar Sumbar.
  if (!recognized) {
    return opts.awaitingLocation && shortMessage && cats.length > 0
      ? { kind: 'reply', reply: replies.unknownLocation(clean, CITY_CHIPS) }
      : { kind: 'llm' };
  }

  // Ada lokasi/anggaran yang dikenal, tetapi juga kata kebutuhan yang tidak dikenal kode ("tukang listrik di
  // padang", "angkat barang berat di tanah datar"): serahkan ke model AI. Jangan menanyakan ulang "cari apa?"
  // atau memakai kategori dari pesan sebelumnya.
  if (!cur.cats.length && leftoverWords(clean, cur.loc?.gram) >= 1) return { kind: 'llm' };

  if (!cats.length) {
    if (cur.loc?.resolution.best) {
      // Warga sudah menyebut kebutuhannya di pesan sebelumnya (yang tak dikenal kode), lalu sekarang hanya
      // menjawab lokasi ("tukang cuci karpet" ... "padang"). Jangan menanyakan "cari apa?" lagi.
      const earlierNeed = previousUserTexts
        .slice(-3)
        .some((t) => !isGreeting(t) && !isThanks(t) && !isMenuRequest(t) && leftoverWords(t) >= 1);
      if (earlierNeed) return { kind: 'llm' };
      const place = cur.loc.resolution.best;
      const available = await categoriesAt(place.id);
      return { kind: 'reply', reply: replies.askCategory(place.name, available, chips) };
    }
    return { kind: 'llm' };
  }

  // Lokasi wajib ditanyakan hanya untuk kategori yang bertanda "perlu lokasi" (diatur di form kategori).
  const needsLocation = cats.some((c) => c.needsLocation);
  // "servis ac di jakarta": ada tempat yang disebut tetapi tidak dikenal di gazetteer Sumbar.
  // Salah ketik ("di padanng") dicoba dulu dengan pencocokan mirip sebelum dinyatakan tidak dikenal.
  const said = norm(clean).match(/\b(?:di|ke|daerah|sekitar|dekat)\s+((?:[a-z0-9]+\s?){1,3})$/);
  if (needsLocation && !cur.loc && said) {
    const fuzzy = await resolveLocation(said[1]);
    if (fuzzy.best) location = { id: fuzzy.best.id, name: fuzzy.best.name };
    else return { kind: 'reply', reply: replies.unknownLocation(said[1].trim(), CITY_CHIPS) };
  }
  if (needsLocation && !location)
    return {
      kind: 'reply',
      reply: replies.askLocation(
        cats.map((c) => c.name),
        CITY_CHIPS
      )
    };

  // Kategori yang punya isian angka `capacity` (gedung, aula, penginapan, dst.) disaring menurut jumlah tamu.
  const wantsVenue = cats.some((c) => c.hasCapacity);
  return {
    kind: 'search',
    args: {
      query: catsText,
      categoryIds: cats.map((c) => c.id),
      locationId: location?.id,
      budget: budget ? { max: budget.max, unit: budget.unit } : undefined,
      minCapacity: wantsVenue ? capacity : undefined,
      limit: 5,
      labels: { names: cats.map((c) => c.name), groups: [...new Set(cats.map((c) => c.group))] }
    },
    ctx: {
      budgetText: budget
        ? `anggaran sampai ${rupiah(budget.max)}${budget.unit === 'per_person' ? ' per orang' : ''}`
        : undefined,
      capacityText: wantsVenue && capacity ? `untuk ${capacity} orang` : undefined
    }
  };
}
