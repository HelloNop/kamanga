import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { searchParamsCache } from '@/lib/searchparams';
import { categoriesQueryOptions, categoryGroupsOptions } from '../api/queries';
import { CategoryTable } from './category-tables';

export default function CategoryListingPage() {
  const search = searchParamsCache.get('name');
  const group = searchParamsCache.get('group');
  const sort = searchParamsCache.get('sort');

  const filters = {
    page: searchParamsCache.get('page'),
    limit: searchParamsCache.get('perPage'),
    ...(search && { search }),
    ...(group && { group }),
    ...(sort && { sort })
  };

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(categoriesQueryOptions(filters));
  void queryClient.prefetchQuery(categoryGroupsOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CategoryTable />
    </HydrationBoundary>
  );
}
