import { queryOptions } from '@tanstack/react-query';
import { getDoorById, getDoorOptions, getDoors } from './service';

export const doorKeys = {
  all: ['doors'] as const,
  list: () => [...doorKeys.all, 'list'] as const,
  options: () => [...doorKeys.all, 'options'] as const,
  detail: (id: number) => [...doorKeys.all, 'detail', id] as const
};

export const doorsQueryOptions = () =>
  queryOptions({ queryKey: doorKeys.list(), queryFn: () => getDoors() });

export const doorOptionsQueryOptions = () =>
  queryOptions({ queryKey: doorKeys.options(), queryFn: () => getDoorOptions() });

export const doorByIdOptions = (id: number) =>
  queryOptions({ queryKey: doorKeys.detail(id), queryFn: () => getDoorById(id) });
