// Data contoh untuk menguji pencarian. SEMUA listing bertanda [CONTOH] dan nomor kontaknya palsu.
// Koordinat kota perkiraan; gazetteer asli diisi sendiri oleh pemilik proyek.
// Jalankan: bun run db:seed  (menolak jalan bila tabel kategori sudah berisi)
import { eq, sql } from 'drizzle-orm';
import { db } from './index';
import * as s from './schema';
import { legacyFlags, legacyGroupId, type LegacyGroup } from './seed-helpers';

const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.categories);
if (count > 0) {
  console.error('Seed dibatalkan: tabel categories sudah berisi data.');
  process.exit(1);
}

const cat = async (slug: string, name: string, group: LegacyGroup, attributeSchema?: unknown[]) =>
  (
    await db
      .insert(s.categories)
      .values({
        slug,
        name,
        groupId: await legacyGroupId(group),
        ...legacyFlags(group),
        attributeSchema
      })
      .returning()
  )[0];

const cats = {
  catering: await cat('catering', 'Katering', 'service'),
  ac: await cat('ac-repair', 'Servis AC', 'service'),
  motor: await cat('motorcycle-repair', 'Servis Motor', 'service'),
  moving: await cat('moving-transport', 'Angkut Barang', 'service'),
  handyman: await cat('handyman', 'Tukang', 'service'),
  venue: await cat('event-venue', 'Gedung Acara', 'place', [
    { key: 'capacity', label: 'Kapasitas (orang)', type: 'number' }
  ]),
  nature: await cat('nature-tourism', 'Wisata Alam', 'attraction'),
  logo: await cat('logo-design', 'Desain Logo', 'freelance')
};

const need = async (slug: string, name: string, categoryIds: number[]) => {
  const [n] = await db.insert(s.needs).values({ slug, name }).returning();
  await db
    .insert(s.needCategories)
    .values(categoryIds.map((categoryId, i) => ({ needId: n.id, categoryId, sortOrder: i })));
};
await need('moving-house', 'Pindahan rumah', [cats.moving.id, cats.handyman.id]);
await need('ac-broken', 'AC rusak', [cats.ac.id]);
await need('weekend-trip', 'Wisata akhir pekan', [cats.nature.id]);

const loc = async (
  slug: string,
  name: string,
  level: (typeof s.locationLevel.enumValues)[number],
  parentId?: number,
  lat?: number,
  lng?: number,
  aliases: string[] = []
) => {
  const [l] = await db
    .insert(s.locations)
    .values({ slug, name, level, parentId, lat, lng })
    .returning();
  if (aliases.length)
    await db
      .insert(s.locationAliases)
      .values(aliases.map((alias) => ({ locationId: l.id, alias })));
  return l;
};
const sumbar = await loc(
  'west-sumatra',
  'Sumatera Barat',
  'province',
  undefined,
  undefined,
  undefined,
  ['Sumbar']
);
const padang = await loc('padang', 'Kota Padang', 'city', sumbar.id, -0.9471, 100.4172, [
  'Padang',
  'Pdg'
]);
const bukittinggi = await loc(
  'bukittinggi',
  'Kota Bukittinggi',
  'city',
  sumbar.id,
  -0.3055,
  100.3692,
  ['Bukittinggi', 'Bukiktinggi', 'Bukik']
);
const lubeg = await loc(
  'lubuk-begalung',
  'Lubuk Begalung',
  'district',
  padang.id,
  undefined,
  undefined,
  ['Lubeg']
);
await loc('pasar-raya-padang', 'Pasar Raya Padang', 'landmark', padang.id, undefined, undefined, [
  'Pasa Raya',
  'Pasar Raya'
]);

await db.insert(s.glossaryTerms).values([
  { term: 'onda', meaning: 'sepeda motor', isChecked: true },
  { term: 'oto', meaning: 'mobil', isChecked: true },
  { term: 'lapau', meaning: 'warung', isChecked: true }
]);
// Sebutan lain untuk kategori contoh ("onda" -> Servis Motor)
await db
  .update(s.categories)
  .set({ aliases: ['onda'] })
  .where(eq(s.categories.id, cats.motor.id));

type NewListing = typeof s.listings.$inferInsert;
const listing = async (v: NewListing, categoryId: number, areaIds: number[] = []) => {
  const [l] = await db
    .insert(s.listings)
    .values({ ...v, name: `[CONTOH] ${v.name}`, source: 'import' })
    .returning();
  await db.insert(s.listingCategories).values({ listingId: l.id, categoryId, isPrimary: true });
  if (areaIds.length)
    await db
      .insert(s.listingAreas)
      .values(areaIds.map((locationId) => ({ listingId: l.id, locationId })));
  return l;
};
const pub = { status: 'published', publishedAt: new Date() } as const;

await listing(
  {
    ...pub,
    slug: 'sample-ac-on-call',
    name: 'Dedi AC Panggilan',
    serviceModes: ['on_call'],
    whatsapp: '6280000000001',
    locationId: padang.id,
    lat: -0.95,
    lng: 100.42,
    keywords: ['cuci ac', 'isi freon'],
    verificationLevel: 'contact_checked'
  },
  cats.ac.id,
  [padang.id]
);
await listing(
  {
    ...pub,
    slug: 'sample-motor-lubeg',
    name: 'Bengkel Onda Lubeg',
    whatsapp: '6280000000002',
    locationId: lubeg.id,
    lat: -0.98,
    lng: 100.4
  },
  cats.motor.id
);
await listing(
  {
    ...pub,
    slug: 'sample-catering',
    name: 'Katering Uni Et',
    whatsapp: '6280000000003',
    locationId: padang.id,
    lat: -0.94,
    lng: 100.41,
    priceMin: 35000,
    priceMax: 60000,
    priceUnit: 'per_person'
  },
  cats.catering.id
);
await listing(
  {
    ...pub,
    slug: 'sample-venue',
    name: 'Gedung Serbaguna',
    whatsapp: '6280000000004',
    locationId: padang.id,
    lat: -0.93,
    lng: 100.37,
    attributes: { capacity: 500 },
    verificationLevel: 'visited'
  },
  cats.venue.id
);
await listing(
  {
    ...pub,
    slug: 'sample-nature',
    name: 'Panorama Bukit',
    locationId: bukittinggi.id,
    lat: -0.3,
    lng: 100.37
  },
  cats.nature.id
);
await listing(
  {
    ...pub,
    slug: 'sample-logo',
    name: 'Rani Desain',
    serviceModes: ['online'],
    whatsapp: '6280000000005'
  },
  cats.logo.id,
  [sumbar.id]
);
await listing(
  {
    slug: 'sample-pending',
    name: 'Tukang Menunggu Review',
    status: 'pending_review',
    whatsapp: '6280000000006',
    locationId: padang.id,
    lat: -0.95,
    lng: 100.41
  },
  cats.handyman.id
);

console.log('Seed selesai.');
process.exit(0);
