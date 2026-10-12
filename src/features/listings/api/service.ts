'use server';
// Pintu masuk dari klien (Server Actions). SETIAP fungsi wajib memanggil requireAdmin() lebih dulu,
// karena Server Action adalah endpoint publik yang bisa dipanggil siapa saja.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { ListingFormValues } from '../schemas/listing';
import type { ImportMode } from '../lib/csv-import';
import type {
  ImportPreview,
  ImportResult,
  ListingFilters,
  ListingDetail,
  ListingOptions,
  ListingsResponse,
  MutationResult,
  SimilarListing
} from './types';

export async function getListings(filters: ListingFilters): Promise<ListingsResponse> {
  await requireAdmin();
  return repo.listListings(filters);
}

export async function getListingById(id: number): Promise<ListingDetail | null> {
  await requireAdmin();
  return repo.getListingDetail(id);
}

export async function getListingOptions(): Promise<ListingOptions> {
  await requireAdmin();
  return repo.getListingOptions();
}

export async function findSimilarListings(input: {
  name: string;
  whatsapp: string;
  excludeId?: number;
}): Promise<SimilarListing[]> {
  await requireAdmin();
  return repo.findSimilarListings(input);
}

export async function createListing(values: ListingFormValues): Promise<MutationResult> {
  const { user } = await requireAdmin();
  return repo.createListing(user.id, values);
}

export async function updateListing(
  id: number,
  values: ListingFormValues
): Promise<MutationResult> {
  const { user } = await requireAdmin();
  return repo.updateListing(user.id, id, values);
}

export async function setListingStatus(
  id: number,
  status: 'draft' | 'published' | 'archived'
): Promise<MutationResult> {
  await requireAdmin();
  if (!['draft', 'published', 'archived'].includes(status))
    return { ok: false, message: 'Status tidak valid' };
  return repo.setListingStatus(id, status);
}

export async function previewListingImport(
  csvText: string,
  mode: ImportMode
): Promise<ImportPreview> {
  await requireAdmin();
  return repo.previewListingImport(String(csvText), mode === 'upsert' ? 'upsert' : 'create');
}

export async function importListings(csvText: string, mode: ImportMode): Promise<ImportResult> {
  const { user } = await requireAdmin();
  return repo.runListingImport(user.id, String(csvText), mode === 'upsert' ? 'upsert' : 'create');
}
