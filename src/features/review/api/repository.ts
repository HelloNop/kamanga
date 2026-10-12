// Logika database antrean review. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { and, asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  categories,
  listingAreas,
  listingCategories,
  listings,
  locations,
  user
} from '@/db/schema';
import { findSimilarListings } from '@/features/listings/api/repository';
import {
  PRICE_UNIT_LABELS,
  SERVICE_MODE_LABELS,
  type ServiceMode
} from '@/features/listings/constants/listing-options';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import { deletePhoto, photoUrl } from '@/lib/storage';
import type {
  MutationResult,
  ReviewDecision,
  ReviewDetail,
  ReviewItem,
  ReviewQueue
} from './types';

const fail = (message: string): MutationResult => ({ ok: false, message });
const rupiah = (n: number) => `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;

/**
 * Yang perlu diperiksa tim: listing yang menunggu review, dan listing terbit yang vendornya
 * menambah foto baru (hanya fotonya yang diperiksa; listingnya tetap tampil).
 */
const needsReview = or(
  eq(listings.status, 'pending_review'),
  and(eq(listings.status, 'published'), sql`cardinality(${listings.pendingPhotos}) > 0`)
);

export async function countPendingReview(): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(listings).where(needsReview);
  return n;
}

/** Antrean: yang menunggu paling lama di atas. */
export async function listReviewQueue(limit = 30): Promise<ReviewQueue> {
  const [rows, total] = await Promise.all([
    db
      .select({
        l: listings,
        categoryName: categories.name,
        locationName: locations.name,
        ownerName: user.name,
        ownerEmail: user.email
      })
      .from(listings)
      .leftJoin(
        listingCategories,
        and(eq(listingCategories.listingId, listings.id), eq(listingCategories.isPrimary, true))
      )
      .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
      .leftJoin(locations, eq(locations.id, listings.locationId))
      .leftJoin(user, eq(user.id, listings.ownerId))
      .where(needsReview)
      .orderBy(asc(listings.updatedAt), asc(listings.id))
      .limit(limit),
    countPendingReview()
  ]);

  const items: ReviewItem[] = await Promise.all(
    rows.map(async ({ l, categoryName, locationName, ownerName, ownerEmail }) => {
      const checks: [boolean, string][] = [
        [!!l.summary?.trim(), 'ringkasan'],
        [!!(l.whatsapp || l.phone), 'kontak'],
        [l.lat !== null && l.lng !== null, 'koordinat peta'],
        [l.priceMin !== null || !!l.priceNote?.trim(), 'harga'],
        [!!l.locationId, 'lokasi']
      ];
      const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
      const similar = await findSimilarListings({
        name: l.name,
        whatsapp: l.whatsapp ?? '',
        excludeId: l.id
      });
      return {
        id: l.id,
        name: l.name,
        slug: l.slug,
        summary: l.summary,
        categoryName,
        locationName,
        source: l.source,
        owner: ownerEmail ? { name: ownerName ?? ownerEmail, email: ownerEmail } : null,
        whatsapp: l.whatsapp,
        phone: l.phone,
        priceText:
          l.priceMin !== null
            ? `${rupiah(l.priceMin)}${l.priceMax ? ` - ${rupiah(l.priceMax)}` : ''}${l.priceUnit ? ` ${PRICE_UNIT_LABELS[l.priceUnit]}` : ''}`
            : null,
        attributeCount: Object.keys(l.attributes ?? {}).length,
        hasCoords: l.lat !== null && l.lng !== null,
        completeness: Math.round(((checks.length - missing.length) / checks.length) * 100),
        missing,
        submittedAt: l.updatedAt.toISOString(),
        photosOnly: l.status === 'published',
        pendingPhotos: l.pendingPhotos.map(photoUrl),
        similar: similar.map((s) => ({ id: s.id, name: s.name, reason: s.reason }))
      };
    })
  );
  return { items, total };
}

/**
 * Setujui = terbit, dan foto yang menunggu ikut tampil. Tolak = ditolak dengan alasan (terlihat
 * oleh pemilik listing). Untuk listing yang sudah terbit, keputusan hanya berlaku pada fotonya.
 */
export async function reviewListing(input: ReviewDecision): Promise<MutationResult> {
  const [prev] = await db
    .select({ status: listings.status, photos: listings.photos, pending: listings.pendingPhotos })
    .from(listings)
    .where(eq(listings.id, input.id))
    .limit(1);
  if (!prev) return fail('Listing tidak ditemukan');
  const photosOnly = prev.status === 'published' && prev.pending.length > 0;
  if (prev.status !== 'pending_review' && !photosOnly)
    return fail('Listing ini sudah tidak menunggu review. Muat ulang halaman.');

  if (input.decision === 'approve') {
    await db
      .update(listings)
      .set({
        ...(photosOnly ? {} : { status: 'published' as const, publishedAt: new Date() }),
        reviewNote: null,
        photos: [...prev.photos, ...prev.pending],
        pendingPhotos: []
      })
      .where(eq(listings.id, input.id));
    return { ok: true, id: input.id };
  }
  const note = input.note.trim();
  if (note.length < 3) return fail('Tulis alasan penolakan (minimal 3 karakter)');
  if (note.length > 500) return fail('Alasan maksimal 500 karakter');
  if (photosOnly) {
    // Foto ditolak dan dihapus; listingnya tetap terbit.
    await db
      .update(listings)
      .set({ reviewNote: `Foto ditolak: ${note}`, pendingPhotos: [] })
      .where(eq(listings.id, input.id));
    await Promise.all(prev.pending.map(deletePhoto));
    return { ok: true, id: input.id };
  }
  await db
    .update(listings)
    .set({ status: 'rejected', reviewNote: note })
    .where(eq(listings.id, input.id));
  return { ok: true, id: input.id };
}

const attrText = (v: unknown) =>
  v === true ? 'Ya' : v === false ? 'Tidak' : Array.isArray(v) ? v.join(', ') : String(v ?? '');

/** Rincian satu listing, dengan isian khusus diberi label dari kategori utamanya. */
export async function getReviewDetail(id: number): Promise<ReviewDetail | null> {
  const [row] = await db
    .select({
      l: listings,
      category: categories,
      ownerName: user.name,
      ownerEmail: user.email
    })
    .from(listings)
    .leftJoin(
      listingCategories,
      and(eq(listingCategories.listingId, listings.id), eq(listingCategories.isPrimary, true))
    )
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .leftJoin(user, eq(user.id, listings.ownerId))
    .where(eq(listings.id, id))
    .limit(1);
  if (!row) return null;
  const { l, category } = row;

  const [extra, areaRows, loc] = await Promise.all([
    db
      .select({ name: categories.name })
      .from(listingCategories)
      .innerJoin(categories, eq(categories.id, listingCategories.categoryId))
      .where(and(eq(listingCategories.listingId, id), eq(listingCategories.isPrimary, false))),
    db
      .select({ locationId: listingAreas.locationId })
      .from(listingAreas)
      .where(eq(listingAreas.listingId, id)),
    l.locationId
      ? db
          .select({ name: locations.name, parentId: locations.parentId })
          .from(locations)
          .where(eq(locations.id, l.locationId))
          .limit(1)
      : Promise.resolve([] as { name: string; parentId: number | null }[])
  ]);
  const areaNames = areaRows.length
    ? await db
        .select({ name: locations.name })
        .from(locations)
        .where(
          inArray(
            locations.id,
            areaRows.map((a) => a.locationId)
          )
        )
    : [];
  // Induk satu tingkat cukup sebagai petunjuk ("Padang Barat" -> "Kota Padang").
  const parent = loc[0]?.parentId
    ? (
        await db
          .select({ name: locations.name })
          .from(locations)
          .where(eq(locations.id, loc[0].parentId))
          .limit(1)
      )[0]
    : undefined;

  const defs = parseAttributeSchema(category?.attributeSchema);
  const values = (l.attributes ?? {}) as Record<string, unknown>;
  const attributes = defs
    .filter((d) => values[d.key] !== undefined && values[d.key] !== '')
    .map((d) => ({ label: d.label, text: attrText(values[d.key]) }));

  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    status: l.status,
    summary: l.summary,
    description: l.description,
    categoryName: category?.name ?? null,
    extraCategories: extra.map((e) => e.name),
    infoOnly: category?.infoOnly ?? false,
    locationName: loc[0]?.name ?? null,
    locationPath: parent?.name ?? null,
    address: l.address,
    lat: l.lat,
    lng: l.lng,
    mapsUrl: l.mapsUrl,
    serviceModes: l.serviceModes.map((m) => SERVICE_MODE_LABELS[m as ServiceMode] ?? m),
    areas: areaNames.map((a) => a.name),
    whatsapp: l.whatsapp,
    phone: l.phone,
    instagram: l.instagram,
    website: l.website,
    priceText:
      l.priceMin !== null
        ? `${rupiah(l.priceMin)}${l.priceMax ? ` - ${rupiah(l.priceMax)}` : ''}${l.priceUnit ? ` ${PRICE_UNIT_LABELS[l.priceUnit]}` : ''}`
        : null,
    priceNote: l.priceNote,
    attributes,
    keywords: l.keywords,
    photos: l.photos.map(photoUrl),
    pendingPhotos: l.pendingPhotos.map(photoUrl),
    source: l.source,
    owner: row.ownerEmail ? { name: row.ownerName ?? row.ownerEmail, email: row.ownerEmail } : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString()
  };
}
