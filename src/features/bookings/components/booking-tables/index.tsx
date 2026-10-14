'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { bookingsQueryOptions } from '../../api/queries';
import { columns } from './columns';

export function BookingTable() {
  // Penguraian harus SAMA dengan useDataTable: kolom berpilihan = larik, selain itu teks.
  const [params] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    listing: parseAsString,
    when: parseAsString,
    status: parseAsArrayOf(parseAsString, ','),
    flag: parseAsArrayOf(parseAsString, ',')
  });

  const filters = {
    page: params.page,
    limit: params.perPage,
    ...(params.listing && { listing: params.listing }),
    ...(params.when && { when: params.when }),
    ...(params.status?.length && { status: params.status.join(',') }),
    ...(params.flag?.length && { flag: params.flag.join(',') })
  };

  const { data, isError, refetch } = useQuery({
    ...bookingsQueryOptions(filters),
    placeholderData: keepPreviousData
  });

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
        <p className='font-medium'>Daftar pesanan gagal dimuat.</p>
        <button
          type='button'
          onClick={() => refetch()}
          className='text-primary mt-2 text-sm underline underline-offset-4'
        >
          Coba lagi
        </button>
      </div>
    );
  if (!data) return <DataTableSkeleton columnCount={7} rowCount={10} filterCount={4} />;

  return (
    <DataTable table={table} totalRows={data.total} emptyMessage='Tidak ada pesanan yang cocok.'>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}
