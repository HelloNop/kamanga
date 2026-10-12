import { queryOptions } from '@tanstack/react-query';
import { findSimilarListings, getListingById, getListingOptions, getListings } from './service';
import type { ListingFilters } from './types';

export const listingKeys = {
  all: ['listings'] as const,
  list: (filters: ListingFilters) => [...listingKeys.all, 'list', filters] as const,
  detail: (id: number) => [...listingKeys.all, 'detail', id] as const,
  options: () => [...listingKeys.all, 'options'] as const,
  similar: (name: string, whatsapp: string, excludeId?: number) =>
    [...listingKeys.all, 'similar', name, whatsapp, excludeId ?? null] as const
};

export const listingsQueryOptions = (filters: ListingFilters) =>
  queryOptions({ queryKey: listingKeys.list(filters), queryFn: () => getListings(filters) });

export const listingByIdOptions = (id: number) =>
  queryOptions({ queryKey: listingKeys.detail(id), queryFn: () => getListingById(id) });

export const listingFormOptions = () =>
  queryOptions({
    queryKey: listingKeys.options(),
    queryFn: () => getListingOptions(),
    staleTime: 5 * 60 * 1000
  });

/** Peringatan listing ganda di formulir. Dipanggil setelah pengguna berhenti mengetik. */
export const similarListingsOptions = (name: string, whatsapp: string, excludeId?: number) =>
  queryOptions({
    queryKey: listingKeys.similar(name, whatsapp, excludeId),
    queryFn: () => findSimilarListings({ name, whatsapp, excludeId }),
    staleTime: 30 * 1000
  });
