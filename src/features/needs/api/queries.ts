import { queryOptions } from '@tanstack/react-query';
import { getNeedById, getNeedOptions, getNeeds } from './service';
import type { NeedFilters } from './types';

export const needKeys = {
  all: ['needs'] as const,
  list: (filters: NeedFilters) => [...needKeys.all, 'list', filters] as const,
  detail: (id: number) => [...needKeys.all, 'detail', id] as const,
  options: () => [...needKeys.all, 'options'] as const
};

export const needsQueryOptions = (filters: NeedFilters) =>
  queryOptions({ queryKey: needKeys.list(filters), queryFn: () => getNeeds(filters) });

export const needByIdOptions = (id: number) =>
  queryOptions({ queryKey: needKeys.detail(id), queryFn: () => getNeedById(id) });

export const needFormOptions = () =>
  queryOptions({
    queryKey: needKeys.options(),
    queryFn: () => getNeedOptions(),
    staleTime: 60 * 1000
  });
