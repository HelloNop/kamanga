'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireVendor() lebih dulu dan
// meneruskan user.id ke repository (yang memfilter menurut pemilik).
import { requireVendor } from '@/lib/session';
import type { ListingDetail, ListingOptions } from '@/features/listings/api/types';
import type { ListingFormValues } from '@/features/listings/schemas/listing';
import * as repo from './repository';
import type { MyListing, SaveIntent, SaveResult, SimpleResult, VendorSummary } from './types';

export async function getMyListings(): Promise<MyListing[]> {
  const { user } = await requireVendor();
  return repo.listMyListings(user.id);
}

export async function getVendorSummary(): Promise<VendorSummary> {
  const { user } = await requireVendor();
  return repo.vendorSummary(user.id);
}

export async function getMyListingById(id: number): Promise<ListingDetail | null> {
  const { user } = await requireVendor();
  return repo.getMyListing(user.id, id);
}

export async function getVendorOptions(): Promise<ListingOptions> {
  await requireVendor();
  return repo.vendorOptions();
}

export async function saveMyListing(
  id: number | null,
  values: ListingFormValues,
  intent: SaveIntent
): Promise<SaveResult> {
  const { user } = await requireVendor();
  return repo.saveMyListing(user.id, id, values, intent);
}

export async function archiveMyListing(id: number): Promise<SimpleResult> {
  const { user } = await requireVendor();
  return repo.archiveMyListing(user.id, id);
}
