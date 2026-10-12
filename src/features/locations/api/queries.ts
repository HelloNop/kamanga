import { queryOptions } from '@tanstack/react-query';
import { getLocationById, getLocationOptions, getLocations } from './service';
import type { LocationFilters } from './types';

export const locationKeys = {
  all: ['locations'] as const,
  list: (filters: LocationFilters) => [...locationKeys.all, 'list', filters] as const,
  detail: (id: number) => [...locationKeys.all, 'detail', id] as const,
  options: () => [...locationKeys.all, 'options'] as const
};

export const locationsQueryOptions = (filters: LocationFilters) =>
  queryOptions({ queryKey: locationKeys.list(filters), queryFn: () => getLocations(filters) });

export const locationByIdOptions = (id: number) =>
  queryOptions({ queryKey: locationKeys.detail(id), queryFn: () => getLocationById(id) });

export const locationFormOptions = () =>
  queryOptions({
    queryKey: locationKeys.options(),
    queryFn: () => getLocationOptions(),
    staleTime: 60 * 1000
  });
