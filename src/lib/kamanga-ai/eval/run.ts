// Mengukur jalur kode (router) pada set uji. TIDAK memanggil model AI: gratis, cepat, dan hasilnya sama setiap kali.
// Jalankan: bun run eval:chat        (tambah --strict agar gagal bila ada kasus yang meleset)
import { db } from '@/db';
import { categories, locations } from '@/db/schema';
import { norm } from '@/lib/directory/norm';
import { decide, type Decision } from '../router';
import { CASES, type EvalCase } from './cases';

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

async function run(c: EvalCase): Promise<{ ok: boolean; got: string; d: Decision }> {
  let d!: Decision;
  for (let i = 0; i < c.turns.length; i++)
    d = await decide(c.turns[i], c.turns.slice(0, i), i, { awaitingLocation: false });
  const e = c.expect;
  if (e.kind === 'llm')
    return {
      ok: d.kind === 'llm',
      got: d.kind === 'search' ? 'search' : d.kind === 'reply' ? 'reply' : 'llm',
      d
    };
  if (e.kind === 'reply') {
    const text = d.kind === 'reply' ? d.reply.text : '';
    return {
      ok: d.kind === 'reply' && new RegExp(e.includes, 'i').test(text),
      got: d.kind === 'reply' ? `reply: ${text.slice(0, 50)}` : d.kind,
      d
    };
  }
  if (d.kind !== 'search')
    return {
      ok: false,
      got: d.kind === 'reply' ? `reply: ${d.reply.text.slice(0, 50)}` : 'llm',
      d
    };
  const gotCats = (d.args.categoryIds ?? []).map((id) => cats.get(id)!);
  const gotNorm = gotCats.map(norm);
  const gotLoc = d.args.locationId ? locs.get(d.args.locationId) : undefined;
  const problems: string[] = [];
  if (e.categories && !e.categories.every((x) => gotNorm.includes(norm(x))))
    problems.push(`kategori ${gotCats.join(',')}`);
  if (e.location !== undefined && gotLoc !== e.location) problems.push(`lokasi ${gotLoc ?? '-'}`);
  if (e.capacity !== undefined && d.args.minCapacity !== e.capacity)
    problems.push(`kapasitas ${d.args.minCapacity ?? '-'}`);
  if (e.budget !== undefined && d.args.budget?.max !== e.budget)
    problems.push(`anggaran ${d.args.budget?.max ?? '-'}`);
  return { ok: problems.length === 0, got: problems.length ? problems.join('; ') : 'search', d };
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
  [...by((c) => c.expect.kind)]
    .map(
      ([k, v]) =>
        `${k === 'search' ? 'dicari kode' : k === 'reply' ? 'jawaban bawaan' : 'perlu AI'} ${v.ok}/${v.n}`
    )
    .join(' | ')
);
console.log(
  `Hemat biaya : ${handledByCode} dari ${CASES_RUN.length} kasus (${pct(handledByCode, CASES_RUN.length)}) memang cukup dikerjakan kode tanpa model AI.`
);
const failed = results.filter((x) => !x.ok);
if (failed.length) {
  console.log(`\nMeleset (${failed.length}):`);
  for (const f of failed)
    console.log(
      `  [${f.c.style}] ${f.c.turns.at(-1)!.padEnd(58)} diharapkan ${f.c.expect.kind}, hasil: ${f.got}`
    );
}
if (process.argv.includes('--strict') && failed.length) process.exit(1);
process.exit(0);
