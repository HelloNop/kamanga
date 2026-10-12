import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { glossaryQueryOptions } from '../api/queries';
import { GlossaryTable } from './glossary-tables';

export default function GlossaryListingPage() {
  const search = searchParamsCache.get('term');
  const status = searchParamsCache.get('status');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page: searchParamsCache.get('page'),
    limit: searchParamsCache.get('perPage'),
    ...(search && { search }),
    ...(status && { checked: status }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(glossaryQueryOptions(filters));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GlossaryTable />
    </HydrationBoundary>
  );
}
