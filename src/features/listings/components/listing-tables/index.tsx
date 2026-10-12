'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useMemo } from 'react';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { getSortingStateParser } from '@/lib/parsers';
import { listingFormOptions, listingsQueryOptions } from '../../api/queries';
import { COLUMN_IDS, getColumns } from './columns';

export function ListingTable() {
  // Filter pilihan memakai penguraian larik yang SAMA dengan useDataTable. nuqs membagikan nilai
  // antar-hook; bila penguraiannya beda, nilai larik bocor ke sini sebagai string dan query gagal.
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    name: parseAsString,
    category: parseAsArrayOf(parseAsString, ','),
    status: parseAsArrayOf(parseAsString, ','),
    verification: parseAsArrayOf(parseAsString, ','),
    sort: getSortingStateParser(COLUMN_IDS).withDefault([])
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.name && { search: params.name }),
    ...(params.category?.length && { categories: params.category.join(',') }),
    ...(params.status?.length && { status: params.status.join(',') }),
    ...(params.verification?.length && { verification: params.verification.join(',') }),
    ...(params.sort.length > 0 && { sort: JSON.stringify(params.sort) })
  };

  // useQuery (bukan useSuspenseQuery): server action tidak boleh dipanggil saat render, dan data
  // lama tetap tampil selagi filter baru dimuat (tanpa kedip skeleton satu halaman).
  const { data, isError, refetch } = useQuery({
    ...listingsQueryOptions(filters),
    placeholderData: keepPreviousData
  });
  const { data: options } = useQuery(listingFormOptions());

  const columns = useMemo(
    () => getColumns((options?.categories ?? []).map((c) => ({ value: c.slug, label: c.name }))),
    [options?.categories]
  );

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    pageCount: Math.ceil((data?.total ?? 0) / params.perPage),
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } }
  });

  if (isError && !data)
    return (
      <div role='alert' className='bg-card rounded-2xl p-6 text-center shadow-sm'>
        <p className='font-medium'>Daftar gagal dimuat.</p>
        <button
          type='button'
          onClick={() => refetch()}
          className='text-primary mt-2 text-sm underline underline-offset-4'
        >
          Coba lagi
        </button>
      </div>
    );
  if (!data) return <DataTableSkeleton columnCount={7} rowCount={10} filterCount={2} />;

  return (
    <DataTable table={table} totalRows={data.total}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
