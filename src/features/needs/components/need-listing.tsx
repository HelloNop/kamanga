import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { needsQueryOptions } from '../api/queries';
import { NeedTable } from './need-tables';

export default function NeedListingPage() {
  const search = searchParamsCache.get('name');
  const status = searchParamsCache.get('status');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page: searchParamsCache.get('page'),
    limit: searchParamsCache.get('perPage'),
    ...(search && { search }),
    ...(status && { status }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(needsQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NeedTable />
    </HydrationBoundary>
  );
}
