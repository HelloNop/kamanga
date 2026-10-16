import { queryOptions } from '@tanstack/react-query';
import { getClaimQueue, getPendingCount, getReviewDetail, getReviewQueue } from './service';

export const reviewKeys = {
  all: ['review'] as const,
  queue: () => [...reviewKeys.all, 'queue'] as const,
  claims: () => [...reviewKeys.all, 'claims'] as const,
  count: () => [...reviewKeys.all, 'count'] as const,
  detail: (id: number) => [...reviewKeys.all, 'detail', id] as const
};

export const reviewQueueOptions = () =>
  queryOptions({ queryKey: reviewKeys.queue(), queryFn: () => getReviewQueue() });

/** Jumlah antrean untuk lencana di sidebar. Diperbarui tiap menit. */
export const pendingCountOptions = () =>
  queryOptions({
    queryKey: reviewKeys.count(),
    queryFn: () => getPendingCount(),
    refetchInterval: 60_000,
    staleTime: 30_000
  });

export const reviewDetailOptions = (id: number) =>
  queryOptions({ queryKey: reviewKeys.detail(id), queryFn: () => getReviewDetail(id) });

export const claimQueueOptions = () =>
  queryOptions({ queryKey: reviewKeys.claims(), queryFn: () => getClaimQueue() });
