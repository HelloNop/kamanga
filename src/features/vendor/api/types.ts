import type { ListingStatus } from '@/features/listings/constants/listing-options';

export type MyListing = {
  id: number;
  name: string;
  slug: string;
  status: ListingStatus;
  reviewNote: string | null;
  categoryName: string | null;
  locationName: string | null;
  completeness: number;
  missing: string[];
  updatedAt: string; // ISO
};

export type VendorSummary = {
  total: number;
  draft: number;
  pending: number;
  published: number;
  rejected: number;
  archived: number;
};

export type SaveIntent = 'draft' | 'submit';

export type SaveResult =
  | { ok: true; id: number; status: ListingStatus; message: string }
  | { ok: false; message: string };

export type SimpleResult = { ok: true; id: number } | { ok: false; message: string };
