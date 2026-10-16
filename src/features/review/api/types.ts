import type { ListingSource } from '@/features/listings/constants/listing-options';

export type ReviewItem = {
  id: number;
  name: string;
  slug: string;
  summary: string | null;
  categoryName: string | null;
  locationName: string | null;
  source: ListingSource;
  /** Akun vendor pengirim, bila listing dikirim vendor. */
  owner: { name: string; email: string } | null;
  whatsapp: string | null;
  phone: string | null;
  priceText: string | null;
  attributeCount: number;
  hasCoords: boolean;
  /** 0-100, dari isian yang sudah terisi. */
  completeness: number;
  /** Yang belum terisi, untuk membantu keputusan. */
  missing: string[];
  submittedAt: string; // ISO (terakhir diubah)
  /** Listing sudah terbit; yang diperiksa hanya foto barunya. */
  photosOnly: boolean;
  /** Alamat foto yang menunggu keputusan. */
  pendingPhotos: string[];
  similar: { id: number; name: string; reason: 'whatsapp' | 'nama' }[];
};

export type ReviewQueue = { items: ReviewItem[]; total: number };

export type ReviewDecision =
  | { id: number; decision: 'approve' }
  | { id: number; decision: 'reject'; note: string };

export type ClaimDecision = { id: number; decision: 'approve' | 'reject' };

export type MutationResult = { ok: true; id: number } | { ok: false; message: string };

/** Rincian lengkap satu listing untuk dibaca admin sebelum memutuskan. */
export type ReviewDetail = {
  id: number;
  name: string;
  slug: string;
  status: string;
  summary: string | null;
  description: string | null;
  categoryName: string | null;
  extraCategories: string[];
  infoOnly: boolean;
  locationName: string | null;
  locationPath: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  serviceModes: string[];
  areas: string[];
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  priceText: string | null;
  priceNote: string | null;
  attributes: { label: string; text: string }[];
  keywords: string[];
  photos: string[];
  pendingPhotos: string[];
  source: ListingSource;
  owner: { name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};
