// Memuat data acuan: kategori, kebutuhan, kamus, dan lokasi Sumbar.
// Aman dijalankan berulang. Hanya MENAMBAH; tidak menimpa ubahan yang sudah Anda buat di panel admin.
// Jalankan: bun run db:seed-reference
import { readFileSync } from 'node:fs';
import { inArray, sql } from 'drizzle-orm';
import { runImport } from '@/features/locations/api/repository';
import { db } from './index';
import { CATEGORIES, NEEDS } from './data/taxonomy';
import { GLOSSARY } from './data/glossary';
import { legacyFlags, legacyGroupId } from './seed-helpers';
import { norm } from '@/lib/directory/norm';
import {
  categories,
  glossaryTerms,
  locationAliases,
  locations,
  needCategories,
  needs
} from './schema';

// 1) Lokasi dulu (sebutan lain bisa menunjuk ke lokasi). Memakai alur impor yang sama dengan panel admin.
//    Urutan penting: data kurasi (kota, kabupaten, sebutan populer) dulu, lalu data resmi (kecamatan, nagari/kelurahan).
for (const file of ['lokasi-sumbar.csv', 'lokasi-sumbar-wilayah.csv']) {
  const csv = readFileSync(new URL(`../../data/${file}`, import.meta.url), 'utf8');
  const imp = await runImport(csv);
  if (!imp.ok) {
    console.error(`Impor ${file} gagal:`, imp.message, imp.errors);
    process.exit(1);
  }
  console.log(`lokasi   : ${file} -> ${imp.created} baru, ${imp.updated} diperbarui`);
}

// 2) Kategori. Yang sudah ada tidak diubah, kecuali atribut yang masih kosong diisi.
const before = await db.$count(categories);
const groupIds = new Map<string, number>();
for (const g of new Set(CATEGORIES.map((c) => c.group))) groupIds.set(g, await legacyGroupId(g));
await db
  .insert(categories)
  .values(
    CATEGORIES.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      groupId: groupIds.get(c.group)!,
      ...legacyFlags(c.group),
      description: c.description,
      sortOrder: (i + 1) * 10,
      attributeSchema: c.attributes ?? null
    }))
  )
  .onConflictDoUpdate({
    target: categories.slug,
    set: {
      attributeSchema: sql`coalesce(${categories.attributeSchema}, excluded.attribute_schema)`
    }
  });
console.log(
  `kategori : ${(await db.$count(categories)) - before} baru (total ${await db.$count(categories)})`
);

// 3) Kebutuhan dan tautannya ke kategori.
const catId = new Map(
  (await db.select({ id: categories.id, slug: categories.slug }).from(categories)).map((c) => [
    c.slug,
    c.id
  ])
);
const needsBefore = await db.$count(needs);
await db
  .insert(needs)
  .values(
    NEEDS.map((n, i) => ({
      slug: n.slug,
      name: n.name,
      description: n.description,
      sortOrder: (i + 1) * 10
    }))
  )
  .onConflictDoNothing();
const needId = new Map(
  (await db.select({ id: needs.id, slug: needs.slug }).from(needs)).map((n) => [n.slug, n.id])
);
const links = NEEDS.flatMap((n) =>
  n.categories.map((slug, i) => {
    if (!catId.has(slug))
      throw new Error(`Kategori "${slug}" pada kebutuhan "${n.slug}" tidak ada`);
    return { needId: needId.get(n.slug)!, categoryId: catId.get(slug)!, sortOrder: i };
  })
);
await db.insert(needCategories).values(links).onConflictDoNothing();
console.log(
  `kebutuhan: ${(await db.$count(needs)) - needsBefore} baru (total ${await db.$count(needs)})`
);

// 4) Sebutan lain (kategori, kebutuhan, lokasi) dan kamus. Istilah bertujuan menjadi sebutan lain
//    pada tujuannya; semuanya juga masuk kamus sebagai kata beserta artinya (belum dicek penutur asli).
const addAlias = (table: 'categories' | 'needs', slug: string, term: string) =>
  db.execute(sql`
    update ${sql.raw(table)} set aliases = (
      select coalesce(array_agg(distinct a), '{}') from unnest(aliases || ${[term]}::text[]) a
    ) where slug = ${slug}`);
for (const g of GLOSSARY) {
  const term = norm(g.term);
  if (g.target?.category) await addAlias('categories', g.target.category, term);
  if (g.target?.need) await addAlias('needs', g.target.need, term);
}
const locTargets = GLOSSARY.flatMap((g) =>
  g.target?.location ? [{ slug: g.target.location, term: norm(g.term) }] : []
);
if (locTargets.length) {
  const locId = new Map(
    (
      await db
        .select({ id: locations.id, slug: locations.slug })
        .from(locations)
        .where(
          inArray(
            locations.slug,
            locTargets.map((l) => l.slug)
          )
        )
    ).map((l) => [l.slug, l.id])
  );
  const rows = locTargets.flatMap((l) =>
    locId.has(l.slug) ? [{ locationId: locId.get(l.slug)!, alias: l.term }] : []
  );
  if (rows.length) await db.insert(locationAliases).values(rows).onConflictDoNothing();
}
const glossBefore = await db.$count(glossaryTerms);
await db
  .insert(glossaryTerms)
  .values(
    GLOSSARY.map((g) => ({
      term: norm(g.term),
      meaning: g.meaning,
      notes: 'Awal dari Claude, perlu dicek penutur asli'
    }))
  )
  .onConflictDoNothing();
console.log(
  `kamus    : ${(await db.$count(glossaryTerms)) - glossBefore} baru (total ${await db.$count(glossaryTerms)})`
);
