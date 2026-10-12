// Logika database portal vendor. TANPA pemeriksaan login: hanya diimpor oleh service.ts, yang
// memanggil requireVendor(). Setiap fungsi di sini WAJIB memfilter berdasarkan pemilik (ownerId).
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { categories, listingCategories, listings, locations } from '@/db/schema';
import {
  createListing,
  getListingDetail,
  getListingOptions,
  updateListing
} from '@/features/listings/api/repository';
import type { ListingDetail, ListingOptions } from '@/features/listings/api/types';
import type { ListingFormValues } from '@/features/listings/schemas/listing';
import type { ListingStatus } from '@/features/listings/constants/listing-options';
import type { MyListing, SaveIntent, SaveResult, SimpleResult, VendorSummary } from './types';

/** Batas listing aktif per vendor (di luar yang diarsipkan), agar tidak disalahgunakan. */
export const MAX_LISTINGS_PER_VENDOR = 20;

/**
 * Mengubah salah satu isian ini membuat listing diperiksa ulang: nama, kategori, ringkasan, dan
 * kontak. Isian lain (harga, isian khusus, alamat, ...) langsung berlaku.
 */
const SENSITIVE = [
  'name',
  'primaryCategoryId',
  'summary',
  'whatsapp',
  'phone',
  'instagram',
  'website',
  'mapsUrl'
] as const;

const fail = (message: string): { ok: false; message: string } => ({ ok: false, message });
const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase();

export async function vendorOptions(): Promise<ListingOptions> {
  return getListingOptions();
}

function completeness(l: typeof listings.$inferSelect) {
  const checks: [boolean, string][] = [
    [!!l.summary?.trim(), 'ringkasan'],
    [!!(l.whatsapp || l.phone), 'kontak'],
    [l.lat !== null && l.lng !== null, 'koordinat peta'],
    [l.priceMin !== null || !!l.priceNote?.trim(), 'harga'],
    [!!l.locationId, 'lokasi']
  ];
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label);
  return {
    completeness: Math.round(((checks.length - missing.length) / checks.length) * 100),
    missing
  };
}

export async function listMyListings(userId: string): Promise<MyListing[]> {
  const rows = await db
    .select({ l: listings, categoryName: categories.name, locationName: locations.name })
    .from(listings)
    .leftJoin(
      listingCategories,
      and(eq(listingCategories.listingId, listings.id), eq(listingCategories.isPrimary, true))
    )
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(eq(listings.ownerId, userId))
    .orderBy(desc(listings.updatedAt));
  return rows.map(({ l, categoryName, locationName }) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    status: l.status,
    reviewNote: l.status === 'rejected' ? l.reviewNote : null,
    categoryName,
    locationName,
    ...completeness(l),
    updatedAt: l.updatedAt.toISOString()
  }));
}

export async function vendorSummary(userId: string): Promise<VendorSummary> {
  const rows = await db
    .select({ status: listings.status })
    .from(listings)
    .where(eq(listings.ownerId, userId));
  const n = (s: ListingStatus) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    draft: n('draft'),
    pending: n('pending_review'),
    published: n('published'),
    rejected: n('rejected'),
    archived: n('archived')
  };
}

/** Detail listing milik vendor. Milik orang lain dianggap tidak ada. */
export async function getMyListing(userId: string, id: number): Promise<ListingDetail | null> {
  const d = await getListingDetail(id);
  return d && d.ownerId === userId ? d : null;
}

// Syarat sebelum dikirim untuk direview.
async function submitProblems(v: ListingFormValues): Promise<string | null> {
  if (!v.summary.trim()) return 'Isi ringkasan usaha dulu (1-2 kalimat).';
  if (!v.locationId) return 'Pilih lokasi usaha dulu.';
  const [cat] = await db
    .select({ infoOnly: categories.infoOnly })
    .from(categories)
    .where(eq(categories.id, Number(v.primaryCategoryId)))
    .limit(1);
  if (!cat) return 'Pilih kategori usaha dulu.';
  if (!cat.infoOnly && !v.whatsapp.trim() && !v.phone.trim())
    return 'Isi minimal satu kontak (WhatsApp atau telepon) agar warga bisa menghubungi.';
  return null;
}

export async function saveMyListing(
  userId: string,
  id: number | null,
  input: ListingFormValues,
  intent: SaveIntent
): Promise<SaveResult> {
  if (intent === 'submit') {
    const problem = await submitProblems(input);
    if (problem) return fail(problem);
  }

  // Isian yang hanya boleh diatur tim tidak diterima dari vendor.
  const base = { ...input, source: 'vendor' as const, sourceUrl: '', reviewNote: '' };

  if (id === null) {
    const active = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.ownerId, userId), ne(listings.status, 'archived')));
    if (active.length >= MAX_LISTINGS_PER_VENDOR)
      return fail(
        `Batas ${MAX_LISTINGS_PER_VENDOR} listing aktif tercapai. Arsipkan yang tidak dipakai dulu.`
      );
    const status: ListingStatus = intent === 'submit' ? 'pending_review' : 'draft';
    const r = await createListing(
      userId,
      { ...base, status, verificationLevel: 'unverified' },
      userId
    );
    if (!r.ok) return r;
    return {
      ok: true,
      id: r.id,
      status,
      message: intent === 'submit' ? 'Listing dikirim untuk direview' : 'Disimpan sebagai draf'
    };
  }

  const prev = await getMyListing(userId, id);
  if (!prev) return fail('Listing tidak ditemukan');
  const prevStatus = prev.values.status;

  const changedSensitive = SENSITIVE.some((k) => norm(prev.values[k]) !== norm(input[k]));
  let status: ListingStatus;
  if (intent === 'draft') {
    if (prevStatus === 'published')
      return fail('Listing yang sudah terbit tidak bisa dijadikan draf.');
    status = 'draft';
  } else if (prevStatus === 'published') {
    // Tetap terbit, kecuali nama/kategori/ringkasan/kontak diubah: diperiksa ulang.
    status = changedSensitive ? 'pending_review' : 'published';
  } else {
    status = 'pending_review';
  }
  // Kontak atau identitas berubah: tanda "sudah dicek" tim tidak berlaku lagi.
  const verificationLevel = changedSensitive ? 'unverified' : prev.values.verificationLevel;

  const r = await updateListing(userId, id, {
    ...base,
    source: prev.values.source,
    sourceUrl: prev.values.sourceUrl,
    status,
    verificationLevel
  });
  if (!r.ok) return r;
  const message =
    status === 'published'
      ? 'Perubahan disimpan'
      : status === 'pending_review'
        ? prevStatus === 'published'
          ? 'Perubahan disimpan. Listing diperiksa ulang sebelum tampil lagi'
          : 'Listing dikirim untuk direview'
        : 'Disimpan sebagai draf';
  return { ok: true, id, status, message };
}

/** Sembunyikan listing dari warga. Bisa dikirim lagi untuk review lewat formulir. */
export async function archiveMyListing(userId: string, id: number): Promise<SimpleResult> {
  const rows = await db
    .update(listings)
    .set({ status: 'archived', reviewNote: null })
    .where(and(eq(listings.id, id), eq(listings.ownerId, userId)))
    .returning({ id: listings.id });
  return rows.length ? { ok: true, id } : fail('Listing tidak ditemukan');
}
