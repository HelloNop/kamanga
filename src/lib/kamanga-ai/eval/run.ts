// Mengukur jalur template + kode (router → niat → mesin) pada set uji. TIDAK memanggil model AI: gratis, cepat,
// dan hasilnya sama setiap kali. Niat dibawa antar-giliran persis seperti chat_sessions.state.
// "Sekarang" uji = besok 10.00 WIB, supaya "nanti malam" selalu di masa depan dan slot dari Mesin Jadwal ada.
// Jalankan: bun run eval:chat        (tambah --strict agar gagal bila ada kasus yang meleset)
import { db } from '@/db';
import { categories, locations } from '@/db/schema';
import { norm } from '@/lib/directory/norm';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';
import { whenRange } from '../extract';
import { decide, type Decision } from '../router';
import { execute } from '../turn';
import type { ChatState, Reply } from '../types';
import { CASES, type EvalCase } from './cases';

process.env.LLM_PROVIDER = 'none';
const NOW = fromJakarta(addDays(jakartaDate(new Date()), 1), '10:00');
const TODAY = jakartaDate(NOW);

const cats = new Map(
  (await db.select({ id: categories.id, name: categories.name }).from(categories)).map((c) => [
    c.id,
    c.name
  ])
);
const locs = new Map(
  (await db.select({ id: locations.id, slug: locations.slug }).from(locations)).map((l) => [
    l.id,
    l.slug
  ])
);

const known = new Set([...cats.values()].map(norm));
// Kasus yang meminta kategori yang belum ada di database tidak bisa dinilai.
const skipped = (c: EvalCase) =>
  c.expect.kind === 'search' && !!c.expect.categories?.some((n) => !known.has(norm(n)));

type Last = { d: Decision; reply?: Reply; state: ChatState };

async function play(c: EvalCase): Promise<Last> {
  let state: ChatState = {};
  let last!: Last;
  for (let i = 0; i < c.turns.length; i++) {
    const t = c.turns[i];
    const turn = typeof t === 'string' ? { text: t } : t;
    const routed = await decide(turn.text, state, {
      now: NOW,
      seed: i,
      action: turn.action ?? null,
      point: turn.point ?? null
    });
    // Model AI dan penerusan pertanyaan (menulis ke database) tidak dijalankan di sini.
    if (routed.decision.kind === 'llm' || routed.decision.kind === 'forward') {
      state = routed.state;
      last = { d: routed.decision, state };
      continue;
    }
    const out = await execute(routed.decision, routed.state, {
      now: NOW,
      seed: i,
      sessionId: null,
      source: 'rules',
      allowModel: false
    });
    state = out.state;
    last = { d: routed.decision, reply: out.reply, state };
  }
  return last;
}

async function run(c: EvalCase): Promise<{ ok: boolean; got: string }> {
  const { d, reply, state } = await play(c);
  const e = c.expect;
  const text = reply?.text ?? '';
  if (e.kind === 'llm') return { ok: d.kind === 'llm', got: d.kind };
  if (e.kind === 'reply') {
    const problems: string[] = [];
    if (d.kind !== 'reply' && d.kind !== 'ask_provider') problems.push(d.kind);
    if (!new RegExp(e.includes, 'i').test(text)) problems.push(`teks "${text.slice(0, 50)}"`);
    if (e.door && state.door?.slug !== e.door) problems.push(`pintu ${state.door?.slug ?? '-'}`);
    if (e.chips && (reply?.chips?.length ?? 0) < e.chips)
      problems.push(`tombol ${reply?.chips?.length ?? 0}`);
    return { ok: !problems.length, got: problems.join('; ') || 'reply' };
  }
  if (e.kind === 'answer')
    return {
      ok:
        (d.kind === 'ask_provider' || d.kind === 'focus') && new RegExp(e.includes, 'i').test(text),
      got: `${d.kind}: ${text.slice(0, 60)}`
    };
  if (d.kind !== 'search' && d.kind !== 'providers')
    return { ok: false, got: d.kind === 'reply' ? `reply: ${text.slice(0, 50)}` : d.kind };

  const gotCats = (state.categories ?? []).map((x) => cats.get(x.id) ?? x.name);
  const gotNorm = gotCats.map(norm);
  const gotLoc = state.region ? locs.get(state.region.id) : undefined;
  const problems: string[] = [];
  if (e.door && state.door?.slug !== e.door) problems.push(`pintu ${state.door?.slug ?? '-'}`);
  if (e.categories && !e.categories.every((x) => gotNorm.includes(norm(x))))
    problems.push(`kategori ${gotCats.join(',')}`);
  if (e.location !== undefined && gotLoc !== e.location) problems.push(`lokasi ${gotLoc ?? '-'}`);
  if (e.capacity !== undefined && state.capacity !== e.capacity)
    problems.push(`kapasitas ${state.capacity ?? '-'}`);
  if (e.budget !== undefined && (state.budget?.max ?? null) !== e.budget)
    problems.push(`anggaran ${state.budget?.max ?? '-'}`);
  if (e.people !== undefined && state.people !== e.people)
    problems.push(`orang ${state.people ?? '-'}`);
  if (e.when !== undefined) {
    const w = state.when;
    const want = e.when
      ? { date: addDays(TODAY, e.when.day), from: e.when.from, to: e.when.to }
      : null;
    if (
      JSON.stringify(w ? { date: w.date, from: w.from, to: w.to } : null) !== JSON.stringify(want)
    )
      problems.push(`waktu ${w ? `${w.date} ${w.from}-${w.to}` : '-'}`);
  }
  if (e.slots) {
    const items = reply?.providers?.items ?? [];
    const range = state.when ? whenRange(state.when) : null;
    const starts = items.flatMap((i) =>
      i.slots.map((s) => new Date(new URL(s.href, 'http://x').searchParams.get('mulai') ?? ''))
    );
    if (!starts.length) problems.push('tanpa slot kosong');
    else if (range && starts.some((t) => !(t >= range.from && t < range.to)))
      problems.push('slot di luar rentang waktu');
  }
  return { ok: problems.length === 0, got: problems.length ? problems.join('; ') : d.kind };
}

const results = [] as { c: EvalCase; ok: boolean; got: string }[];
const skippedCases = CASES.filter(skipped);
const CASES_RUN = CASES.filter((c) => !skipped(c));
for (const c of CASES_RUN) results.push({ c, ...(await run(c)) });

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
const by = <K extends string>(key: (c: EvalCase) => K) => {
  const m = new Map<K, { n: number; ok: number }>();
  for (const x of results)
    m.set(key(x.c), {
      n: (m.get(key(x.c))?.n ?? 0) + 1,
      ok: (m.get(key(x.c))?.ok ?? 0) + (x.ok ? 1 : 0)
    });
  return m;
};
const LABEL: Record<string, string> = {
  search: 'diteruskan ke mesin/pencarian',
  reply: 'jawaban bawaan',
  answer: 'jawaban dari data penyedia',
  llm: 'perlu AI'
};
const ok = results.filter((x) => x.ok).length;
const handledByCode = CASES_RUN.filter((c) => c.expect.kind !== 'llm').length;
console.log(
  `\nKasus diuji: ${CASES_RUN.length} | benar: ${ok} (${pct(ok, CASES_RUN.length)}) | dilewati: ${skippedCases.length} (kategorinya belum ada di database)`
);
console.log(
  'Per gaya    :',
  [...by((c) => c.style)].map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(' | ')
);
console.log(
  'Per jalur   :',
  [...by((c) => c.expect.kind)].map(([k, v]) => `${LABEL[k]} ${v.ok}/${v.n}`).join(' | ')
);
console.log(
  `Hemat biaya : ${handledByCode} dari ${CASES_RUN.length} kasus (${pct(handledByCode, CASES_RUN.length)}) memang cukup dikerjakan kode tanpa model AI.`
);
const failed = results.filter((x) => !x.ok);
if (failed.length) {
  console.log(`\nMeleset (${failed.length}):`);
  for (const f of failed) {
    const last = f.c.turns.at(-1)!;
    console.log(
      `  [${f.c.style}] ${(typeof last === 'string' ? last : last.text).padEnd(58)} diharapkan ${f.c.expect.kind}, hasil: ${f.got}`
    );
  }
}
if (process.argv.includes('--strict') && failed.length) process.exit(1);
process.exit(0);
