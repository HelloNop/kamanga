import { mutationOptions } from '@tanstack/react-query';
import { listingKeys } from '@/features/listings/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { locationKeys } from './queries';
import {
  createLocation,
  deleteLocation,
  importLocations,
  previewLocationImport,
  updateLocation
} from './service';
import type { LocationFormValues, MutationResult } from './types';

const unwrap = (r: MutationResult) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
// Pilihan lokasi di formulir listing ikut berubah, jadi segarkan juga.
const refresh = () =>
  Promise.all([
    getQueryClient().invalidateQueries({ queryKey: locationKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: listingKeys.options() })
  ]);

export const createLocationMutation = mutationOptions({
  mutationFn: async (values: LocationFormValues) => unwrap(await createLocation(values)),
  onSuccess: refresh
});
export const updateLocationMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: LocationFormValues }) =>
    unwrap(await updateLocation(id, values)),
  onSuccess: refresh
});
export const deleteLocationMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await deleteLocation(id)),
  onSuccess: refresh
});
export const previewImportMutation = mutationOptions({
  mutationFn: (csv: string) => previewLocationImport(csv)
});
export const runImportMutation = mutationOptions({
  mutationFn: (csv: string) => importLocations(csv),
  onSuccess: refresh
});
