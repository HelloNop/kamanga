// Memuat data acuan: pintu, kategori, kebutuhan, kamus, dan lokasi Sumbar.
// Aman dijalankan berulang. Hanya MENAMBAH; tidak menimpa ubahan yang sudah Anda buat di panel admin.
// Jalankan: bun run db:seed-reference
import { readFileSync } from 'node:fs';
import { inArray, sql } from 'drizzle-orm';
import { runImport } from '@/features/locations/api/repository';
import { db } from './index';
import { DOORS } from './data/doors';
import { CATEGORIES, NEEDS } from './data/taxonomy';
import { GLOSSARY } from './data/glossary';
import { legacyFlags, legacyGroupId } from './seed-helpers';
import { norm } from '@/lib/directory/norm';
import {
  categories,
  doors,
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

// 2) Pintu. Yang sudah ada tidak diubah (nama, ikon, status diatur admin).
const doorsBefore = await db.$count(doors);
await db
  .insert(doors)
  .values(DOORS.map((d, i) => ({ ...d, sortOrder: (i + 1) * 10 })))
  .onConflictDoNothing();
const doorId = new Map(
  (await db.select({ id: doors.id, slug: doors.slug }).from(doors)).map((d) => [d.slug, d.id])
);
for (const c of CATEGORIES)
  if (c.door && !doorId.has(c.door))
    throw new Error(`Pintu "${c.door}" pada "${c.slug}" tidak ada`);
console.log(
  `pintu    : ${(await db.$count(doors)) - doorsBefore} baru (total ${await db.$count(doors)})`
);

// Nama bawaan lama yang diganti di tahap 1; hanya diganti bila admin belum mengubahnya.
const RENAMED: Record<string, string> = {
  salon: 'Salon & Barbershop',
  'car-rental': 'Sewa Mobil & Travel',
  'sport-venue': 'Lapangan Olahraga'
};
for (const [slug, oldName] of Object.entries(RENAMED)) {
  const c = CATEGORIES.find((x) => x.slug === slug)!;
  await db.execute(
    sql`update categories set name = ${c.name} where slug = ${slug} and name = ${oldName}`
  );
}

// 3) Kategori. Yang sudah ada tidak diubah, kecuali yang masih kosong diisi: atribut, pintu, batas waktu,
//    dan jenis jadwal (hanya selama kategori belum punya pintu, tanda belum diatur untuk tahap 1).
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
      attributeSchema: c.attributes ?? null,
      doorId: c.door ? doorId.get(c.door)! : null,
      scheduleKind: c.schedule ?? 'none',
      responseMinutes: c.responseMinutes ?? null
    }))
  )
  .onConflictDoUpdate({
    target: categories.slug,
    set: {
      attributeSchema: sql`coalesce(${categories.attributeSchema}, excluded.attribute_schema)`,
      scheduleKind: sql`case when ${categories.doorId} is null then excluded.schedule_kind else ${categories.scheduleKind} end`,
      doorId: sql`coalesce(${categories.doorId}, excluded.door_id)`,
      responseMinutes: sql`coalesce(${categories.responseMinutes}, excluded.response_minutes)`
    }
  });
console.log(
  `kategori : ${(await db.$count(categories)) - before} baru (total ${await db.$count(categories)})`
);

// 4) Kebutuhan dan tautannya ke kategori.
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

// 5) Sebutan lain (pintu, kategori, kebutuhan, lokasi) dan kamus. Istilah bertujuan menjadi sebutan lain
//    pada tujuannya; semuanya juga masuk kamus sebagai kata beserta artinya (belum dicek penutur asli).
const addAlias = (table: 'doors' | 'categories' | 'needs', slug: string, term: string) =>
  db.execute(sql`
    update ${sql.raw(table)} set aliases = (
      select coalesce(array_agg(distinct a), '{}') from unnest(array_append(aliases, ${term})) a
    ) where slug = ${slug}`);
for (const c of CATEGORIES)
  for (const a of c.aliases ?? []) await addAlias('categories', c.slug, norm(a));
for (const g of GLOSSARY) {
  const term = norm(g.term);
  if (g.target?.door) await addAlias('doors', g.target.door, term);
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
