import { mutationOptions } from '@tanstack/react-query';
import { listingKeys } from '@/features/listings/api/queries';
import { overviewKeys } from '@/features/overview/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { reviewKeys } from './queries';
import { decideClaim, reviewListing } from './service';
import type { ClaimDecision, ReviewDecision } from './types';

// Keputusan mengubah daftar listing dan angka di dashboard, jadi segarkan semuanya.
const refresh = () =>
  Promise.all([
    getQueryClient().invalidateQueries({ queryKey: reviewKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: listingKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: overviewKeys.all })
  ]);

export const reviewListingMutation = mutationOptions({
  mutationFn: async (input: ReviewDecision) => {
    const r = await reviewListing(input);
    if (!r.ok) throw new Error(r.message);
    return r;
  },
  onSuccess: refresh
});

export const decideClaimMutation = mutationOptions({
  mutationFn: async (input: ClaimDecision) => {
    const r = await decideClaim(input);
    if (!r.ok) throw new Error(r.message);
    return r;
  },
  onSuccess: refresh
});
