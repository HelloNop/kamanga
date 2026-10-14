import type { AttributeDef } from '../lib/format';
import type { ImportError } from '../lib/csv-import';
import type { ListingFormValues } from '../schemas/listing';
import type { ListingStatus, ListingSource, VerificationLevel } from '../constants/listing-options';

export type { ListingFormValues, AttributeDef, ImportError };

// status, verification, categories: daftar dipisah koma (cocok dengan filter multiSelect di URL).
export type ListingFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  verification?: string;
  categories?: string;
  kind?: string; // provider | place, dipisah koma
  sort?: string; // JSON: [{ id, desc }]
};

export type ListingRow = {
  id: number;
  kind: 'provider' | 'place';
  slug: string;
  name: string;
  status: ListingStatus;
  verificationLevel: VerificationLevel;
  source: ListingSource;
  whatsapp: string | null;
  ownerId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  locationName: string | null;
  updatedAt: string; // ISO
};

export type ListingsResponse = { items: ListingRow[]; total: number };

export type CategoryOption = {
  id: number;
  slug: string;
  name: string;
  /** Nama kelompok (rak besar). Dipakai untuk mengelompokkan pilihan di formulir. */
  group: string | null;
  /** Kategori hanya memberi informasi: tidak ada tombol hubungi. */
  infoOnly: boolean;
  attributes: AttributeDef[];
};
export type SimilarListing = {
  id: number;
  name: string;
  locationName: string | null;
  reason: 'whatsapp' | 'nama';
};
export type LocationOption = {
  id: number;
  name: string;
  level: string;
  parentName: string | null;
  /** Rantai induk tanpa provinsi, mis. "Padang Barat, Kota Padang". */
  path: string | null;
};
export type ListingOptions = { categories: CategoryOption[]; locations: LocationOption[] };

export type PhotoItem = { key: string; url: string };

export type ListingDetail = {
  id: number;
  values: ListingFormValues;
  /** Foto yang sudah tampil ke warga (yang pertama = sampul) dan yang menunggu review. */
  photos: PhotoItem[];
  pendingPhotos: PhotoItem[];
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MutationResult = { ok: true; id: number } | { ok: false; message: string };

export type ImportPreview = {
  totals: { create: number; update: number; skip: number };
  errorCount: number;
  errors: ImportError[]; // maksimal 100 pertama
  sample: { line: number; slug: string; name: string; action: 'create' | 'update' | 'skip' }[];
};
export type ImportResult =
  | { ok: true; created: number; updated: number; skipped: number }
  | { ok: false; message: string; errors: ImportError[] };
