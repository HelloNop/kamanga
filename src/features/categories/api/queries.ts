import { queryOptions } from '@tanstack/react-query';
import { getCategories, getCategoryById, getCategoryGroups } from './service';
import type { CategoryFilters } from './types';

export const categoryKeys = {
  all: ['categories'] as const,
  list: (filters: CategoryFilters) => [...categoryKeys.all, 'list', filters] as const,
  detail: (id: number) => [...categoryKeys.all, 'detail', id] as const,
  groups: () => [...categoryKeys.all, 'groups'] as const
};

export const categoriesQueryOptions = (filters: CategoryFilters) =>
  queryOptions({ queryKey: categoryKeys.list(filters), queryFn: () => getCategories(filters) });

export const categoryByIdOptions = (id: number) =>
  queryOptions({ queryKey: categoryKeys.detail(id), queryFn: () => getCategoryById(id) });

export const categoryGroupsOptions = () =>
  queryOptions({ queryKey: categoryKeys.groups(), queryFn: () => getCategoryGroups() });
