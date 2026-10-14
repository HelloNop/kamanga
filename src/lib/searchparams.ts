import {
  createSearchParamsCache,
  createSerializer,
  parseAsInteger,
  parseAsString
} from 'nuqs/server';

export const searchParams = {
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(20),
  name: parseAsString,
  term: parseAsString,
  category: parseAsString,
  status: parseAsString,
  verification: parseAsString,
  group: parseAsString,
  level: parseAsString,
  sort: parseAsString
};

export const searchParamsCache = createSearchParamsCache(searchParams);
export const serialize = createSerializer(searchParams);
