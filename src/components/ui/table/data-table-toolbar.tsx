'use client';

import type { Column, Table } from '@tanstack/react-table';
import * as React from 'react';

import { DataTableDateFilter } from '@/components/ui/table/data-table-date-filter';
import { DataTableFacetedFilter } from '@/components/ui/table/data-table-faceted-filter';
import { DataTableViewOptions } from '@/components/ui/table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

interface DataTableToolbarProps<TData> extends React.ComponentProps<'div'> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({
  table,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanFilter()),
    [table]
  );

  const onReset = React.useCallback(() => {
    table.resetColumnFilters();
  }, [table]);

  return (
    <div
      role='toolbar'
      aria-orientation='horizontal'
      className={cn('flex w-full items-start justify-between gap-2', className)}
      {...props}
    >
      <div className='flex flex-1 flex-wrap items-center gap-2'>
        {columns.map((column) => (
          <DataTableToolbarFilter key={column.id} column={column} />
        ))}
        {isFiltered && (
          <Button
            aria-label='Atur ulang filter'
            variant='outline'
            size='sm'
            className='border-dashed'
            onClick={onReset}
          >
            <Icons.close />
            Atur ulang
          </Button>
        )}
      </div>
      <div className='flex items-center gap-2'>
        {children}
        <DataTableViewOptions table={table} />
      </div>
    </div>
  );
}
interface DataTableToolbarFilterProps<TData> {
  column: Column<TData>;
}

function DataTableToolbarFilter<TData>({ column }: DataTableToolbarFilterProps<TData>) {
  {
    const columnMeta = column.columnDef.meta;

    const onFilterRender = React.useCallback(() => {
      if (!columnMeta?.variant) return null;

      switch (columnMeta.variant) {
        case 'text':
          return (
            <div className='bg-card text-muted-foreground focus-within:ring-ring/40 flex h-10 w-full max-w-80 items-center gap-2.5 rounded-full px-4 shadow-sm focus-within:ring-2 sm:w-72'>
              <Icons.search className='size-4 shrink-0' />
              <input
                type='search'
                placeholder={columnMeta.placeholder ?? columnMeta.label}
                aria-label={columnMeta.label ?? 'Cari'}
                value={(column.getFilterValue() as string) ?? ''}
                onChange={(event) => column.setFilterValue(event.target.value)}
                className='text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none'
              />
              {!!column.getFilterValue() && (
                <button
                  type='button'
                  aria-label='Hapus pencarian'
                  onClick={() => column.setFilterValue(undefined)}
                  className='hover:text-foreground -mr-1 grid size-6 shrink-0 place-items-center rounded-full'
                >
                  <Icons.close className='size-4' />
                </button>
              )}
            </div>
          );

        case 'date':
        case 'dateRange':
          return (
            <DataTableDateFilter
              column={column}
              title={columnMeta.label ?? column.id}
              multiple={columnMeta.variant === 'dateRange'}
            />
          );

        case 'select':
        case 'multiSelect':
          return (
            <DataTableFacetedFilter
              column={column}
              title={columnMeta.label ?? column.id}
              options={columnMeta.options ?? []}
              multiple={columnMeta.variant === 'multiSelect'}
            />
          );

        default:
          return null;
      }
    }, [column, columnMeta]);

    return onFilterRender();
  }
}
