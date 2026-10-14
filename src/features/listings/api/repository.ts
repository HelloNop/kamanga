// Logika database listing. TANPA pemeriksaan login: jangan diimpor dari komponen klien.
// Semua pintu masuk dari klien harus lewat service.ts (yang memanggil requireAdmin()).
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { photoUrl } from '@/lib/storage';
import {
  categories,
  categoryGroups,
  listingAreas,
  listingCategories,
  listings,
  locations
} from '@/db/schema';
import {
  STATUSES,
  VERIFICATIONS,
  type ListingStatus,
  type PriceUnit
} from '../constants/listing-options';
import {
  cleanAttributes,
  normalizeWhatsapp,
  parseAttributeSchema,
  slugify,
  type AttributeValue
} from '../lib/format';
import {
  parseListingCsv,
  planListingImport,
  type ImportMode,
  type PlannedRow
} from '../lib/csv-import';
import { listingFormSchema, type ListingFormValues } from '../schemas/listing';
import type {
  ImportPreview,
  ImportResult,
  ListingDetail,
  ListingFilters,
  ListingOptions,
  ListingRow,
  ListingsResponse,
  MutationResult,
  SimilarListing
} from './types';

const csv = (s?: string | string[]) =>
  Array.isArray(s)
    ? s.map((x) => x.trim()).filter(Boolean)
    : s
      ? s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const nul = (s: string) => s.trim() || null;

// ───────────────────────────── Baca ─────────────────────────────

const SORTABLE = {
  name: listings.name,
  status: listings.status,
  updatedAt: listings.updatedAt
} as const;

export async function listListings(f: ListingFilters): Promise<ListingsResponse> {
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conds: SQL[] = [];
  if (f.search?.trim()) {
    const q = `%${escapeLike(f.search.trim())}%`;
    conds.push(or(ilike(listings.name, q), ilike(listings.slug, q))!);
  }
  const statuses = csv(f.status).filter((s): s is ListingStatus =>
    (STATUSES as readonly string[]).includes(s)
  );
  if (statuses.length) conds.push(inArray(listings.status, statuses));
  const levels = csv(f.verification).filter((s) =>
    (VERIFICATIONS as readonly string[]).includes(s)
  );
  if (levels.length)
    conds.push(inArray(listings.verificationLevel, levels as (typeof VERIFICATIONS)[number][]));
  const catSlugs = csv(f.categories);
  if (catSlugs.length) {
    conds.push(
      exists(
        db
          .select({ x: sql`1` })
          .from(listingCategories)
          .innerJoin(categories, eq(categories.id, listingCategories.categoryId))
          .where(
            and(eq(listingCategories.listingId, listings.id), inArray(categories.slug, catSlugs))
          )
      )
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  let order: SQL[] = [desc(listings.updatedAt), desc(listings.id)];
  try {
    const parsed = JSON.parse(f.sort ?? '[]') as { id: string; desc: boolean }[];
    const picked = parsed.filter((s) => s.id in SORTABLE);
    if (picked.length) {
      order = [
        ...picked.map((s) => (s.desc ? desc : asc)(SORTABLE[s.id as keyof typeof SORTABLE])),
        desc(listings.id)
      ];
    }
  } catch {
    /* sort tidak valid: pakai urutan bawaan */
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: listings.id,
        slug: listings.slug,
        name: listings.name,
        status: listings.status,
        verificationLevel: listings.verificationLevel,
        source: listings.source,
        whatsapp: listings.whatsapp,
        ownerId: listings.ownerId,
        updatedAt: listings.updatedAt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        locationName: locations.name
      })
      .from(listings)
      .leftJoin(
        listingCategories,
        and(eq(listingCategories.listingId, listings.id), eq(listingCategories.isPrimary, true))
      )
      .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
      .leftJoin(locations, eq(locations.id, listings.locationId))
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(listings).where(where)
  ]);

  return {
    items: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }) satisfies ListingRow),
    total
  };
}

export async function getListingOptions(): Promise<ListingOptions> {
  const [cats, locs] = await Promise.all([
    db
      .select({ category: categories, group: categoryGroups.name })
      .from(categories)
      .leftJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
      .where(eq(categories.isActive, true))
      .orderBy(asc(categoryGroups.name), asc(categories.sortOrder), asc(categories.name)),
    db
      .select({
        id: locations.id,
        name: locations.name,
        level: locations.level,
        parentId: locations.parentId
      })
      .from(locations)
      .orderBy(asc(locations.name))
  ]);
  const byId = new Map(locs.map((l) => [l.id, l.name]));
  const byLoc = new Map(locs.map((l) => [l.id, l]));
  // Rantai induk sampai sebelum provinsi, agar kampung bernama sama mudah dibedakan.
  const pathOf = (parentId: number | null) => {
    const names: string[] = [];
    for (let p = parentId, n = 0; p && n < 6; n++) {
      const l = byLoc.get(p);
      if (!l || l.level === 'province') break;
      names.push(l.name);
      p = l.parentId;
    }
    return names.length ? names.join(', ') : null;
  };
  return {
    categories: cats.map(({ category: c, group }) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      group,
      infoOnly: c.infoOnly,
      attributes: parseAttributeSchema(c.attributeSchema)
    })),
    locations: locs.map((l) => ({
      id: l.id,
      name: l.name,
      level: l.level,
      parentName: l.parentId ? (byId.get(l.parentId) ?? null) : null,
      path: pathOf(l.parentId)
    }))
  };
}

/**
 * Listing yang mirip: nomor WhatsApp sama, atau nama hampir sama (pg_trgm).
 * Hanya untuk peringatan di formulir, bukan penghalang.
 */
export async function findSimilarListings(input: {
  name: string;
  whatsapp: string;
  excludeId?: number;
}): Promise<SimilarListing[]> {
  const name = input.name.trim();
  const wa = normalizeWhatsapp(input.whatsapp);
  if (name.length < 3 && !wa) return [];
  const rows = await db
    .select({
      id: listings.id,
      name: listings.name,
      locationName: locations.name,
      byWhatsapp: wa ? sql<boolean>`${listings.whatsapp} = ${wa}` : sql<boolean>`false`
    })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(
      and(
        input.excludeId ? sql`${listings.id} <> ${input.excludeId}` : undefined,
        or(
          wa ? eq(listings.whatsapp, wa) : undefined,
          name.length >= 3 ? sql`similarity(${listings.name}, ${name}) > 0.6` : undefined
        )
      )
    )
    .limit(5);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    locationName: r.locationName,
    reason: r.byWhatsapp ? 'whatsapp' : 'nama'
  }));
}

export async function getListingDetail(id: number): Promise<ListingDetail | null> {
  const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!row) return null;
  const [cats, areas] = await Promise.all([
    db.select().from(listingCategories).where(eq(listingCategories.listingId, id)),
    db.select().from(listingAreas).where(eq(listingAreas.listingId, id))
  ]);
  const values: ListingFormValues = {
    name: row.name,
    slug: row.slug,
    summary: row.summary ?? '',
    description: row.description ?? '',
    kind: row.kind,
    primaryCategoryId: String(cats.find((c) => c.isPrimary)?.categoryId ?? ''),
    extraCategoryIds: cats.filter((c) => !c.isPrimary).map((c) => String(c.categoryId)),
    serviceModes: row.serviceModes,
    locationId: row.locationId ? String(row.locationId) : '',
    address: row.address ?? '',
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    areaIds: areas.map((a) => String(a.locationId)),
    pointIsPublic: row.pointIsPublic,
    serviceRadiusKm: row.serviceRadiusKm ?? undefined,
    whatsapp: row.whatsapp ?? '',
    phone: row.phone ?? '',
    instagram: row.instagram ?? '',
    website: row.website ?? '',
    mapsUrl: row.mapsUrl ?? '',
    priceMin: row.priceMin ?? undefined,
    priceMax: row.priceMax ?? undefined,
    priceUnit: row.priceUnit ?? '',
    priceNote: row.priceNote ?? '',
    attributes: row.attributes as Record<string, AttributeValue>,
    keywords: row.keywords,
    status: row.status,
    reviewNote: row.reviewNote ?? '',
    verificationLevel: row.verificationLevel,
    source: row.source,
    sourceUrl: row.sourceUrl ?? ''
  };
  return {
    id: row.id,
    values,
    photos: row.photos.map((key) => ({ key, url: photoUrl(key) })),
    pendingPhotos: row.pendingPhotos.map((key) => ({ key, url: photoUrl(key) })),
    ownerId: row.ownerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

// ───────────────────────────── Tulis ─────────────────────────────

async function slugTaken(slug: string, exceptId?: number) {
  const [hit] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.slug, slug))
    .limit(1);
  return !!hit && hit.id !== exceptId;
}

async function resolveSlug(
  v: ListingFormValues,
  exceptId?: number
): Promise<string | MutationResult> {
  if (v.slug)
    return (await slugTaken(v.slug, exceptId))
      ? { ok: false, message: 'Slug sudah dipakai listing lain' }
      : v.slug;
  const base = slugify(v.name) || 'listing';
  let candidate = base;
  for (let n = 2; await slugTaken(candidate, exceptId); n++) candidate = `${base}-${n}`;
  return candidate;
}

type CategoryRow = typeof categories.$inferSelect;

async function toDbValues(v: ListingFormValues, preloaded?: CategoryRow) {
  const cat =
    preloaded ??
    (
      await db
        .select()
        .from(categories)
        .where(eq(categories.id, Number(v.primaryCategoryId)))
        .limit(1)
    )[0];
  if (!cat) return null;
  return {
    kind: v.kind,
    name: v.name.trim(),
    summary: nul(v.summary),
    description: nul(v.description),
    address: nul(v.address),
    locationId: v.locationId ? Number(v.locationId) : null,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    pointIsPublic: v.pointIsPublic,
    serviceRadiusKm: v.serviceRadiusKm ?? null,
    serviceModes: v.serviceModes,
    whatsapp: v.whatsapp.trim() ? normalizeWhatsapp(v.whatsapp) : null,
    phone: nul(v.phone),
    instagram: nul(v.instagram),
    website: nul(v.website),
    mapsUrl: nul(v.mapsUrl),
    priceMin: v.priceMin ?? null,
    priceMax: v.priceMax ?? null,
    priceUnit: (v.priceUnit || null) as PriceUnit | null,
    priceNote: nul(v.priceNote),
    attributes: cleanAttributes(v.attributes, parseAttributeSchema(cat.attributeSchema)),
    keywords: [...new Set(v.keywords.map((k) => k.trim()).filter(Boolean))],
    status: v.status,
    reviewNote: v.status === 'rejected' ? nul(v.reviewNote) : null,
    verificationLevel: v.verificationLevel,
    source: v.source,
    sourceUrl: nul(v.sourceUrl)
  };
}

function relationRows(listingId: number, v: ListingFormValues) {
  const primary = Number(v.primaryCategoryId);
  const extra = [...new Set(v.extraCategoryIds.map(Number))].filter((id) => id !== primary);
  return {
    cats: [
      { listingId, categoryId: primary, isPrimary: true },
      ...extra.map((categoryId) => ({ listingId, categoryId, isPrimary: false }))
    ],
    areas: [...new Set(v.areaIds.map(Number))].map((locationId) => ({ listingId, locationId }))
  };
}

const fail = (message: string): MutationResult => ({ ok: false, message });
const isUniqueViolation = (e: unknown) =>
  (e as { cause?: { code?: string } })?.cause?.code === '23505';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbValues = NonNullable<Awaited<ReturnType<typeof toDbValues>>>;

async function insertListing(
  tx: Tx,
  userId: string,
  v: ListingFormValues,
  data: DbValues,
  slug: string,
  ownerId: string | null = null
): Promise<number> {
  const now = new Date();
  const [row] = await tx
    .insert(listings)
    .values({
      ...data,
      slug,
      createdBy: userId,
      ownerId,
      publishedAt: v.status === 'published' ? now : null,
      verifiedAt: v.verificationLevel === 'unverified' ? null : now,
      verifiedBy: v.verificationLevel === 'unverified' ? null : userId
    })
    .returning({ id: listings.id });
  const rel = relationRows(row.id, v);
  await tx.insert(listingCategories).values(rel.cats);
  if (rel.areas.length) await tx.insert(listingAreas).values(rel.areas);
  return row.id;
}

type Prev = { status: ListingStatus; verificationLevel: (typeof VERIFICATIONS)[number] };

async function applyUpdate(
  tx: Tx,
  userId: string,
  id: number,
  prev: Prev,
  v: ListingFormValues,
  data: DbValues,
  slug: string
) {
  const now = new Date();
  const verifiedPatch =
    v.verificationLevel === 'unverified'
      ? { verifiedAt: null, verifiedBy: null }
      : v.verificationLevel === prev.verificationLevel
        ? {}
        : { verifiedAt: now, verifiedBy: userId };
  const publishedPatch =
    v.status === 'published' && prev.status !== 'published' ? { publishedAt: now } : {};
  await tx
    .update(listings)
    .set({ ...data, slug, ...verifiedPatch, ...publishedPatch })
    .where(eq(listings.id, id));
  const rel = relationRows(id, v);
  await tx.delete(listingCategories).where(eq(listingCategories.listingId, id));
  await tx.insert(listingCategories).values(rel.cats);
  await tx.delete(listingAreas).where(eq(listingAreas.listingId, id));
  if (rel.areas.length) await tx.insert(listingAreas).values(rel.areas);
}

export async function createListing(
  userId: string,
  input: ListingFormValues,
  /** Pemilik listing (akun vendor). Kosong untuk listing yang dibuat tim. */
  ownerId: string | null = null
): Promise<MutationResult> {
  const parsed = listingFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const v = parsed.data;
  const data = await toDbValues(v);
  if (!data) return fail('Kategori utama tidak ditemukan');
  const slug = await resolveSlug(v);
  if (typeof slug !== 'string') return slug;
  try {
    return {
      ok: true,
      id: await db.transaction((tx) => insertListing(tx, userId, v, data, slug, ownerId))
    };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai listing lain' : 'Gagal menyimpan listing'
    );
  }
}

export async function updateListing(
  userId: string,
  id: number,
  input: ListingFormValues
): Promise<MutationResult> {
  const parsed = listingFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const v = parsed.data;
  const [prev] = await db
    .select({ status: listings.status, verificationLevel: listings.verificationLevel })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!prev) return fail('Listing tidak ditemukan');
  const data = await toDbValues(v);
  if (!data) return fail('Kategori utama tidak ditemukan');
  const slug = await resolveSlug(v, id);
  if (typeof slug !== 'string') return slug;
  try {
    await db.transaction((tx) => applyUpdate(tx, userId, id, prev, v, data, slug));
    return { ok: true, id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai listing lain' : 'Gagal menyimpan listing'
    );
  }
}

// Aksi cepat dari tabel. `rejected` sengaja tidak ada di sini: penolakan wajib disertai alasan lewat formulir.
export async function setListingStatus(
  id: number,
  status: 'draft' | 'published' | 'archived'
): Promise<MutationResult> {
  const [prev] = await db
    .select({ status: listings.status })
    .from(listings)
    .where(eq(listings.id, id))
    .limit(1);
  if (!prev) return fail('Listing tidak ditemukan');
  await db
    .update(listings)
    .set({
      status,
      reviewNote: null,
      ...(status === 'published' && prev.status !== 'published' ? { publishedAt: new Date() } : {})
    })
    .where(eq(listings.id, id));
  return { ok: true, id };
}

// ───────────────────────────── Impor CSV ─────────────────────────────

const MAX_CSV_CHARS = 900_000; // di bawah batas 1 MB Server Action

type ReadyRow = {
  line: number;
  slug: string;
  name: string;
  action: PlannedRow['action'];
  existingId?: number;
  values: ListingFormValues;
};

async function prepareImport(text: string, mode: ImportMode) {
  const fail1 = (message: string) => ({
    ready: [] as ReadyRow[],
    errors: [{ line: 1, message }],
    cats: new Map<number, CategoryRow>()
  });
  if (text.length > MAX_CSV_CHARS) return fail1('File terlalu besar (maksimal sekitar 900 KB)');
  const parsed = parseListingCsv(text);
  if (parsed.errors.length)
    return { ready: [] as ReadyRow[], errors: parsed.errors, cats: new Map<number, CategoryRow>() };

  const [cats, locs, existing] = await Promise.all([
    db.select().from(categories).where(eq(categories.isActive, true)),
    db
      .select({
        id: locations.id,
        slug: locations.slug,
        name: locations.name,
        level: locations.level,
        parentId: locations.parentId
      })
      .from(locations),
    db.select({ id: listings.id, slug: listings.slug }).from(listings)
  ]);
  const nameOf = new Map(locs.map((l) => [l.id, l.name]));
  const plan = planListingImport(
    parsed.rows,
    {
      categories: cats.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        attributes: parseAttributeSchema(c.attributeSchema)
      })),
      locations: locs.map((l) => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        level: l.level,
        parentName: l.parentId ? (nameOf.get(l.parentId) ?? null) : null
      })),
      existing: new Map(existing.map((e) => [e.slug, e.id]))
    },
    mode
  );

  const errors = [...plan.errors];
  const ready: ReadyRow[] = [];
  for (const row of plan.planned) {
    if (row.action !== 'update') {
      ready.push({ ...row, values: row.values as ListingFormValues });
      continue;
    }
    // Perbarui: mulai dari data yang ada, timpa hanya kolom yang diisi di CSV.
    const detail = await getListingDetail(row.existingId!);
    if (!detail) {
      errors.push({ line: row.line, message: 'listing yang akan diperbarui tidak ditemukan' });
      continue;
    }
    const merged = {
      ...detail.values,
      ...row.values,
      slug: row.slug,
      attributes: { ...detail.values.attributes, ...row.values.attributes }
    };
    const ok = listingFormSchema.safeParse(merged);
    if (!ok.success)
      errors.push({ line: row.line, message: ok.error.issues[0]?.message ?? 'data tidak valid' });
    else ready.push({ ...row, values: ok.data });
  }
  return {
    ready,
    errors: errors.sort((a, b) => a.line - b.line),
    cats: new Map(cats.map((c) => [c.id, c]))
  };
}

export async function previewListingImport(text: string, mode: ImportMode): Promise<ImportPreview> {
  const { ready, errors } = await prepareImport(text, mode);
  const count = (a: PlannedRow['action']) => ready.filter((r) => r.action === a).length;
  return {
    totals: { create: count('create'), update: count('update'), skip: count('skip') },
    errorCount: errors.length,
    errors: errors.slice(0, 100),
    sample: ready
      .slice(0, 15)
      .map((r) => ({ line: r.line, slug: r.slug, name: r.values.name, action: r.action }))
  };
}

// Semua-atau-tidak-sama-sekali: satu transaksi untuk seluruh file.
export async function runListingImport(
  userId: string,
  text: string,
  mode: ImportMode
): Promise<ImportResult> {
  const { ready, errors, cats } = await prepareImport(text, mode);
  if (errors.length)
    return {
      ok: false,
      message: `Ada ${errors.length} kesalahan; tidak ada yang diimpor.`,
      errors: errors.slice(0, 100)
    };
  const work = ready.filter((r) => r.action !== 'skip');
  const skipped = ready.length - work.length;
  if (!work.length)
    return {
      ok: false,
      message: skipped ? 'Semua baris sudah ada dan dilewati.' : 'Tidak ada baris untuk diimpor.',
      errors: []
    };

  try {
    return await db.transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      for (const r of work) {
        const data = await toDbValues(r.values, cats.get(Number(r.values.primaryCategoryId)));
        if (!data) throw new Error(`kategori baris ${r.line} tidak ditemukan`);
        if (r.action === 'create') {
          await insertListing(tx, userId, r.values, data, r.slug);
          created++;
        } else {
          const [prev] = await tx
            .select({ status: listings.status, verificationLevel: listings.verificationLevel })
            .from(listings)
            .where(eq(listings.id, r.existingId!))
            .limit(1);
          await applyUpdate(tx, userId, r.existingId!, prev, r.values, data, r.slug);
          updated++;
        }
      }
      return { ok: true as const, created, updated, skipped };
    });
  } catch {
    return {
      ok: false,
      message: 'Impor gagal dan dibatalkan; tidak ada data yang berubah.',
      errors: []
    };
  }
}
