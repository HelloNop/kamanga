import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { listingFormOptions, listingsQueryOptions } from '../api/queries';
import { ListingTable } from './listing-tables';

// Server: ambil data awal supaya tabel langsung terisi, lalu klien mengambil alih (React Query).
export default function ListingListingPage({ kind }: { kind?: string }) {
  const search = searchParamsCache.get('name');
  const categories = searchParamsCache.get('category');
  const status = searchParamsCache.get('status');
  const verification = searchParamsCache.get('verification');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page: searchParamsCache.get('page'),
    limit: searchParamsCache.get('perPage'),
    ...(search && { search }),
    ...(kind && { kind }),
    ...(categories && { categories }),
    ...(status && { status }),
    ...(verification && { verification }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(listingsQueryOptions(filters));
  void queryClient.prefetchQuery(listingFormOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListingTable />
    </HydrationBoundary>
  );
}
