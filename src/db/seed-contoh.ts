// Memuat data CONTOH: beberapa kelompok, kategori, kebutuhan, kamus, dan listing dummy.
// Aman diulang (tidak menimpa). Hapus semuanya: bun run db:clear-contoh
// Jalankan: bun run db:seed-contoh   (butuh data lokasi: bun run db:seed-reference atau impor lewat panel)
import { eq, inArray, like } from 'drizzle-orm';
import { norm } from '@/lib/directory/norm';
import { db } from './index';
import { CATEGORIES, GROUPS, KAMUS, NEEDS } from './data/contoh';
import {
  categories,
  categoryGroups,
  glossaryTerms,
  listingAreas,
  listingCategories,
  listings,
  locations,
  needCategories,
  needs
} from './schema';

// Acak dengan benih tetap: hasil selalu sama.
let seed = 20261011;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const between = (lo: number, hi: number, step = 1) =>
  lo + Math.floor((rand() * (hi - lo)) / step) * step;
const chance = (p: number) => rand() < p;
const days = (n: number) => new Date(Date.now() - n * 86_400_000);

// ───── lokasi yang dipakai (harus sudah ada) ─────
const WANTED = [
  { slug: 'padang-barat', w: 20, city: 'padang' },
  { slug: 'padang-timur', w: 12, city: 'padang' },
  { slug: 'padang-utara', w: 8, city: 'padang' },
  { slug: 'padang-selatan', w: 8, city: 'padang' },
  { slug: 'nanggalo', w: 8, city: 'padang' },
  { slug: 'kuranji', w: 8, city: 'padang' },
  { slug: 'lubuk-begalung', w: 10, city: 'padang' },
  { slug: 'koto-tangah', w: 8, city: 'padang' },
  { slug: 'pauh', w: 4, city: 'padang' },
  { slug: 'guguk-panjang', w: 8, city: 'bukittinggi' },
  { slug: 'payakumbuh-barat', w: 6, city: 'payakumbuh' }
];
const locRows = await db
  .select({ id: locations.id, slug: locations.slug, lat: locations.lat, lng: locations.lng })
  .from(locations)
  .where(
    inArray(locations.slug, [...WANTED.map((w) => w.slug), 'padang', 'bukittinggi', 'payakumbuh'])
  );
const loc = new Map(locRows.map((l) => [l.slug, l]));
const missing = [...WANTED.map((w) => w.slug), 'padang', 'bukittinggi', 'payakumbuh'].filter(
  (s) => !loc.has(s)
);
if (missing.length) {
  console.error(`Lokasi belum ada: ${missing.join(', ')}. Muat data lokasi dulu.`);
  process.exit(1);
}
const pickPlace = () => {
  let r = rand() * WANTED.reduce((a, p) => a + p.w, 0);
  return WANTED.find((p) => (r -= p.w) < 0) ?? WANTED[0];
};
const CENTER: Record<string, [number, number]> = {
  padang: [-0.9471, 100.4172],
  bukittinggi: [-0.3055, 100.3692],
  payakumbuh: [-0.22, 100.63]
};

// ───── kelompok, kategori, kebutuhan, kamus ─────
const groupId = new Map<string, number>();
for (const g of GROUPS) {
  const [hit] = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(eq(categoryGroups.name, g.name))
    .limit(1);
  if (hit) groupId.set(g.slug, hit.id);
  else {
    const [row] = await db.insert(categoryGroups).values(g).returning({ id: categoryGroups.id });
    groupId.set(g.slug, row.id);
  }
}

await db
  .insert(categories)
  .values(
    CATEGORIES.map((c, i) => ({
      slug: c.slug,
      name: c.name,
      groupId: groupId.get(c.group)!,
      aliases: c.aliases.map(norm),
      needsLocation: c.needsLocation ?? true,
      infoOnly: c.infoOnly ?? false,
      sortOrder: (i + 1) * 10,
      attributeSchema: c.attributes
    }))
  )
  .onConflictDoNothing();
const catId = new Map(
  (
    await db
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(like(categories.slug, 'contoh-%'))
  ).map((c) => [c.slug, c.id])
);

await db
  .insert(needs)
  .values(
    NEEDS.map((n, i) => ({
      slug: n.slug,
      name: n.name,
      aliases: n.aliases.map(norm),
      sortOrder: (i + 1) * 10
    }))
  )
  .onConflictDoNothing();
const needId = new Map(
  (
    await db
      .select({ id: needs.id, slug: needs.slug })
      .from(needs)
      .where(like(needs.slug, 'contoh-%'))
  ).map((n) => [n.slug, n.id])
);
await db
  .insert(needCategories)
  .values(
    NEEDS.flatMap((n) =>
      n.categories.map((c, i) => ({
        needId: needId.get(n.slug)!,
        categoryId: catId.get(c)!,
        sortOrder: i
      }))
    )
  )
  .onConflictDoNothing();

await db
  .insert(glossaryTerms)
  .values(
    KAMUS.map(([term, meaning, isChecked]) => ({
      term: norm(term),
      meaning,
      isChecked,
      notes: 'Data contoh'
    }))
  )
  .onConflictDoNothing();

// ───── listing dummy ─────
type Row = typeof listings.$inferInsert;
const rows: (Row & { _cat: string; _areas: number[] })[] = [];
let waSeq = 100;
for (const c of CATEGORIES) {
  c.names.forEach((base, i) => {
    const place = pickPlace();
    const isOnline = c.modes.length === 1 && c.modes[0] === 'online';
    const home = isOnline ? WANTED[0] : place;
    const city = CENTER[home.city];
    const hasCoords = !isOnline && chance(0.75);
    const r = rand();
    const status =
      r < 0.7
        ? 'published'
        : r < 0.8
          ? 'draft'
          : r < 0.9
            ? 'pending_review'
            : r < 0.95
              ? 'rejected'
              : 'archived';
    const published = status === 'published';
    const v = rand();
    const verification = !published
      ? 'unverified'
      : v < 0.35
        ? 'unverified'
        : v < 0.75
          ? 'contact_checked'
          : 'visited';
    const modes = c.modes.length > 1 && chance(0.4) ? [c.modes[0]] : c.modes;
    const attrs: Record<string, unknown> = {};
    for (const a of c.attributes) {
      if (chance(0.15)) continue; // sebagian sengaja kosong
      if (a.type === 'boolean') attrs[a.key] = chance(0.6);
      else if (a.type === 'number')
        attrs[a.key] =
          a.key === 'capacity'
            ? between(100, 800, 50)
            : a.key === 'min_porsi'
              ? between(10, 50, 5)
              : between(1, 5);
      else if (a.type === 'select') attrs[a.key] = pick(a.options!);
      else if (a.type === 'multiselect')
        attrs[a.key] = a.options!.filter((_, k) => k === 0 || chance(0.5));
    }
    let priceMin: number | null = null;
    let priceMax: number | null = null;
    if (c.price && chance(c.price.chance)) {
      const step =
        c.price.min[1] >= 1_000_000 ? 250_000 : c.price.min[1] >= 100_000 ? 5_000 : 1_000;
      priceMin = between(c.price.min[0], c.price.min[1], step);
      priceMax = chance(0.6) ? priceMin + between(0, Math.max(step, priceMin), step) : null;
    }
    const updated = days(between(0, 20));
    const needsLoc = c.needsLocation ?? true;
    rows.push({
      _cat: c.slug,
      _areas: modes.includes('on_call') ? [loc.get(home.city)!.id] : [],
      slug: `dummy-${c.slug.replace('contoh-', '')}-${i + 1}`,
      name: `[DUMMY] ${base}`,
      summary: c.summary,
      address: !isOnline && needsLoc ? `Jl. Contoh No. ${between(1, 99)}` : null,
      locationId: loc.get(home.slug)!.id,
      lat: hasCoords ? city[0] + (rand() - 0.5) * 0.06 : null,
      lng: hasCoords ? city[1] + (rand() - 0.5) * 0.06 : null,
      serviceModes: modes,
      whatsapp: chance(0.9) ? `628000${String(++waSeq).padStart(6, '0')}` : null,
      priceMin,
      priceMax,
      priceUnit: priceMin !== null ? (c.price!.unit as Row['priceUnit']) : null,
      attributes: attrs,
      keywords: c.keywords,
      status: status as Row['status'],
      reviewNote: status === 'rejected' ? 'Nomor kontak tidak bisa dihubungi.' : null,
      verificationLevel: verification as Row['verificationLevel'],
      verifiedAt: verification === 'unverified' ? null : updated,
      publishedAt: published ? updated : null,
      source: 'team',
      createdAt: days(between(21, 40)),
      updatedAt: updated
    });
  });
}

const before = await db.$count(listings, like(listings.slug, 'dummy-%'));
for (const r of rows) {
  const { _cat, _areas, ...values } = r;
  const [row] = await db
    .insert(listings)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: listings.id });
  if (!row) continue; // sudah ada
  await db
    .insert(listingCategories)
    .values({ listingId: row.id, categoryId: catId.get(_cat)!, isPrimary: true });
  if (_areas.length)
    await db
      .insert(listingAreas)
      .values(_areas.map((locationId) => ({ listingId: row.id, locationId })));
}
const after = await db.$count(listings, like(listings.slug, 'dummy-%'));

console.log(`kelompok : ${GROUPS.length} (yang belum ada dibuat)`);
console.log(`kategori : ${catId.size}, kebutuhan: ${needId.size}, kamus: ${KAMUS.length}`);
console.log(`listing  : ${after - before} baru (total dummy ${after})`);
process.exit(0);
