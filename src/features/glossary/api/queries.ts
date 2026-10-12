import { queryOptions } from '@tanstack/react-query';
import { getGlossary, getGlossaryById } from './service';
import type { GlossaryFilters } from './types';

export const glossaryKeys = {
  all: ['glossary'] as const,
  list: (filters: GlossaryFilters) => [...glossaryKeys.all, 'list', filters] as const,
  detail: (id: number) => [...glossaryKeys.all, 'detail', id] as const
};

export const glossaryQueryOptions = (filters: GlossaryFilters) =>
  queryOptions({ queryKey: glossaryKeys.list(filters), queryFn: () => getGlossary(filters) });

export const glossaryByIdOptions = (id: number) =>
  queryOptions({ queryKey: glossaryKeys.detail(id), queryFn: () => getGlossaryById(id) });
