import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import type { ListingFormValues } from '@/features/listings/schemas/listing';
import { vendorKeys } from './queries';
import { archiveMyListing, saveMyListing } from './service';
import type { SaveIntent } from './types';

const refresh = () => getQueryClient().invalidateQueries({ queryKey: vendorKeys.all });

export const saveMyListingMutation = mutationOptions({
  mutationFn: async (v: { id: number | null; values: ListingFormValues; intent: SaveIntent }) => {
    const r = await saveMyListing(v.id, v.values, v.intent);
    if (!r.ok) throw new Error(r.message);
    return r;
  },
  onSuccess: refresh
});

export const archiveMyListingMutation = mutationOptions({
  mutationFn: async (id: number) => {
    const r = await archiveMyListing(id);
    if (!r.ok) throw new Error(r.message);
    return r;
  },
  onSuccess: refresh
});
