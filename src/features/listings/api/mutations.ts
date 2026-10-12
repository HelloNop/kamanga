import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { listingKeys } from './queries';
import type { ImportMode } from '../lib/csv-import';
import {
  createListing,
  importListings,
  previewListingImport,
  setListingStatus,
  updateListing
} from './service';
import type { ListingFormValues, MutationResult } from './types';

// Server Action mengembalikan {ok:false,message}; ubah jadi error agar `onError` / toast bekerja.
const unwrap = (r: MutationResult) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
const refresh = () => getQueryClient().invalidateQueries({ queryKey: listingKeys.all });

export const createListingMutation = mutationOptions({
  mutationFn: async (values: ListingFormValues) => unwrap(await createListing(values)),
  onSuccess: refresh
});

export const updateListingMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: ListingFormValues }) =>
    unwrap(await updateListing(id, values)),
  onSuccess: refresh
});

export const setListingStatusMutation = mutationOptions({
  mutationFn: async ({ id, status }: { id: number; status: 'draft' | 'published' | 'archived' }) =>
    unwrap(await setListingStatus(id, status)),
  onSuccess: refresh
});

export const previewListingImportMutation = mutationOptions({
  mutationFn: ({ csv, mode }: { csv: string; mode: ImportMode }) => previewListingImport(csv, mode)
});
export const runListingImportMutation = mutationOptions({
  mutationFn: ({ csv, mode }: { csv: string; mode: ImportMode }) => importListings(csv, mode),
  onSuccess: refresh
});
