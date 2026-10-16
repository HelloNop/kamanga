import { queryOptions } from '@tanstack/react-query';
import { getSettings } from './service';

export const settingsKeys = { all: ['settings'] as const };

export const settingsQueryOptions = () =>
  queryOptions({ queryKey: settingsKeys.all, queryFn: () => getSettings() });
