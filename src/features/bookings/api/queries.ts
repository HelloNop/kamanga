import { queryOptions } from '@tanstack/react-query';
import { getBookingById, getBookings, getForwardQueue, getPendingCitizenMessages } from './service';
import type { BookingFilters } from './types';

export const bookingKeys = {
  all: ['admin-bookings'] as const,
  list: (filters: BookingFilters) => [...bookingKeys.all, 'list', filters] as const,
  queue: () => [...bookingKeys.all, 'queue'] as const,
  citizenQueue: () => [...bookingKeys.all, 'citizen-queue'] as const,
  detail: (id: number) => [...bookingKeys.all, 'detail', id] as const
};

export const bookingsQueryOptions = (filters: BookingFilters) =>
  queryOptions({ queryKey: bookingKeys.list(filters), queryFn: () => getBookings(filters) });

// Sisa waktu menjawab berubah tiap menit: segarkan antrean berkala.
export const forwardQueueOptions = () =>
  queryOptions({
    queryKey: bookingKeys.queue(),
    queryFn: () => getForwardQueue(),
    refetchInterval: 60_000
  });

export const bookingByIdOptions = (id: number) =>
  queryOptions({ queryKey: bookingKeys.detail(id), queryFn: () => getBookingById(id) });

export const citizenQueueOptions = () =>
  queryOptions({
    queryKey: bookingKeys.citizenQueue(),
    queryFn: () => getPendingCitizenMessages(),
    refetchInterval: 60_000
  });
