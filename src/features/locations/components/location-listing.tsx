import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { locationsQueryOptions } from '../api/queries';
import { LocationTable } from './location-tables';

export default function LocationListingPage() {
  const search = searchParamsCache.get('name');
  const level = searchParamsCache.get('level');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page: searchParamsCache.get('page'),
    limit: searchParamsCache.get('perPage'),
    ...(search && { search }),
    ...(level && { level }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(locationsQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LocationTable />
    </HydrationBoundary>
  );
}
