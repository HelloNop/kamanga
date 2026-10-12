// Nilai harus sama dengan enum di src/db/schema.ts. Label untuk tampilan Bahasa Indonesia.

export const STATUSES = ['draft', 'pending_review', 'published', 'rejected', 'archived'] as const;
export const VERIFICATIONS = ['unverified', 'contact_checked', 'visited'] as const;
export const SERVICE_MODES = ['on_site', 'on_call', 'online'] as const;
export const PRICE_UNITS = [
  'per_event',
  'per_hour',
  'per_day',
  'per_visit',
  'per_person',
  'per_item',
  'per_project',
  'other'
] as const;
export const SOURCES = ['team', 'vendor', 'import'] as const;

export type ListingStatus = (typeof STATUSES)[number];
export type VerificationLevel = (typeof VERIFICATIONS)[number];
export type ServiceMode = (typeof SERVICE_MODES)[number];
export type PriceUnit = (typeof PRICE_UNITS)[number];
export type ListingSource = (typeof SOURCES)[number];

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Draf',
  pending_review: 'Menunggu review',
  published: 'Terbit',
  rejected: 'Ditolak',
  archived: 'Diarsipkan'
};
export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  unverified: 'Belum terverifikasi',
  contact_checked: 'Kontak dicek',
  visited: 'Dicek langsung'
};
export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  on_site: 'Pelanggan datang ke tempat',
  on_call: 'Datang ke pelanggan (panggilan)',
  online: 'Daring'
};
export const PRICE_UNIT_LABELS: Record<PriceUnit, string> = {
  per_event: 'per acara',
  per_hour: 'per jam',
  per_day: 'per hari',
  per_visit: 'per kunjungan',
  per_person: 'per orang',
  per_item: 'per item',
  per_project: 'per proyek',
  other: 'lainnya'
};
export const SOURCE_LABELS: Record<ListingSource, string> = {
  team: 'Tim Kamanga',
  vendor: 'Vendor',
  import: 'Impor'
};
export const LOCATION_LEVEL_LABELS: Record<string, string> = {
  province: 'provinsi',
  city: 'kota/kabupaten',
  district: 'kecamatan',
  village: 'nagari/kelurahan',
  landmark: 'tempat dikenal'
};

const toOptions = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

export const STATUS_OPTIONS = toOptions(STATUS_LABELS);
export const VERIFICATION_OPTIONS = toOptions(VERIFICATION_LABELS);
export const SERVICE_MODE_OPTIONS = toOptions(SERVICE_MODE_LABELS);
export const PRICE_UNIT_OPTIONS = toOptions(PRICE_UNIT_LABELS);
export const SOURCE_OPTIONS = toOptions(SOURCE_LABELS);

/** Jumlah foto maksimal per listing (sudah disetujui + menunggu review). */
export const MAX_PHOTOS = 6;
