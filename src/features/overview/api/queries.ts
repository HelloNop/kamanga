import { queryOptions } from '@tanstack/react-query';
import { getOverview } from './service';

export const overviewKeys = {
  all: ['overview'] as const
};

export const overviewQueryOptions = () =>
  queryOptions({ queryKey: overviewKeys.all, queryFn: () => getOverview() });
