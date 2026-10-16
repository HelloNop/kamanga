// Bacaan untuk halaman publik (/jelajah, /listing/[slug]). Hanya listing berstatus `published`.
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { categories, listingAreas, listingCategories, listings, locations } from '@/db/schema';
import { formatAttributeValue, parseAttributeSchema } from '@/features/listings/lib/format';
import { photoUrl } from '@/lib/storage';

export async function getPublicListing(slug: string) {
  const [l] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.slug, slug), eq(listings.status, 'published')))
    .limit(1);
  if (!l) return null;

  const [cats, loc, areaRows] = await Promise.all([
    db
      .select({ c: categories, isPrimary: listingCategories.isPrimary })
      .from(listingCategories)
      .innerJoin(categories, eq(categories.id, listingCategories.categoryId))
      .where(eq(listingCategories.listingId, l.id)),
    l.locationId
      ? db
          .select({ name: locations.name, parentId: locations.parentId })
          .from(locations)
          .where(eq(locations.id, l.locationId))
          .limit(1)
      : Promise.resolve([] as { name: string; parentId: number | null }[]),
    db
      .select({ name: locations.name })
      .from(listingAreas)
      .innerJoin(locations, eq(locations.id, listingAreas.locationId))
      .where(eq(listingAreas.listingId, l.id))
  ]);
  const parent = loc[0]?.parentId
    ? (
        await db
          .select({ name: locations.name })
          .from(locations)
          .where(eq(locations.id, loc[0].parentId))
          .limit(1)
      )[0]
    : undefined;

  const primary = cats.find((c) => c.isPrimary)?.c ?? null;
  const values = (l.attributes ?? {}) as Record<string, unknown>;
  const attributes = parseAttributeSchema(primary?.attributeSchema)
    .filter((d) => values[d.key] !== undefined && values[d.key] !== '')
    .map((d) => ({ label: d.label, text: formatAttributeValue(d, values[d.key]) }));

  return {
    ...l,
    photoUrls: l.photos.map(photoUrl),
    category: primary
      ? { id: primary.id, slug: primary.slug, name: primary.name, infoOnly: primary.infoOnly }
      : null,
    extraCategories: cats.filter((c) => !c.isPrimary).map((c) => c.c.name),
    place: [loc[0]?.name, parent?.name].filter(Boolean).join(', ') || null,
    areas: areaRows.map((a) => a.name),
    attributes
  };
}

/** Pilihan filter di /jelajah: kategori yang punya listing terbit, dan kota/kabupaten. */
export async function getBrowseOptions() {
  const [cats, cities] = await Promise.all([
    db
      .select({ id: categories.id, slug: categories.slug, name: categories.name })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.name)),
    db
      .select({ id: locations.id, slug: locations.slug, name: locations.name })
      .from(locations)
      .where(inArray(locations.level, ['city']))
      .orderBy(asc(locations.name))
  ]);
  return { categories: cats, cities };
}
