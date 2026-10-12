import { queryOptions } from '@tanstack/react-query';
import { getMyListingById, getMyListings, getVendorOptions, getVendorSummary } from './service';

export const vendorKeys = {
  all: ['vendor'] as const,
  list: () => [...vendorKeys.all, 'list'] as const,
  detail: (id: number) => [...vendorKeys.all, 'detail', id] as const,
  options: () => [...vendorKeys.all, 'options'] as const,
  summary: () => [...vendorKeys.all, 'summary'] as const
};

export const myListingsOptions = () =>
  queryOptions({ queryKey: vendorKeys.list(), queryFn: () => getMyListings() });
export const myListingByIdOptions = (id: number) =>
  queryOptions({ queryKey: vendorKeys.detail(id), queryFn: () => getMyListingById(id) });
export const vendorFormOptions = () =>
  queryOptions({
    queryKey: vendorKeys.options(),
    queryFn: () => getVendorOptions(),
    staleTime: 5 * 60 * 1000
  });
export const vendorSummaryOptions = () =>
  queryOptions({ queryKey: vendorKeys.summary(), queryFn: () => getVendorSummary() });
