'use client';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Pill } from '@/components/ui/pill';
import type { NeedRow } from '../../api/types';
import { CellAction } from './cell-action';

// id kolom = nama parameter URL (name, status) dan kunci urutan (name, updatedAt).
export const COLUMN_IDS = ['name', 'aliases', 'categories', 'status', 'updatedAt', 'actions'];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' }
];

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

const header = (title: string) =>
  function Header({ column }: { column: Column<NeedRow, unknown> }) {
    return <DataTableColumnHeader column={column} title={title} />;
  };

const dash = <span className='text-muted-foreground'>-</span>;

export const columns: ColumnDef<NeedRow>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: header('Nama'),
    cell: ({ row }) => (
      <div className='min-w-40'>
        <div className='font-semibold'>{row.original.name}</div>
        <div className='text-muted-foreground text-xs'>{row.original.slug}</div>
      </div>
    ),
    meta: {
      label: 'Nama',
      placeholder: 'Cari nama, slug, atau sebutan...',
      variant: 'text',
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'aliases',
    accessorKey: 'aliases',
    enableSorting: false,
    header: 'Sebutan lain',
    cell: ({ row }) => (
      <span className='block max-w-56 truncate'>
        {row.original.aliases.length ? row.original.aliases.join(', ') : dash}
      </span>
    )
  },
  {
    id: 'categories',
    accessorKey: 'categoryNames',
    enableSorting: false,
    header: 'Kategori terkait',
    cell: ({ row }) => (
      <span className='block max-w-72 truncate'>
        {row.original.categoryNames.length ? row.original.categoryNames.join(', ') : dash}
      </span>
    )
  },
  {
    id: 'status',
    accessorKey: 'isActive',
    enableSorting: false,
    header: 'Status',
    cell: ({ row }) => (
      <Pill tone={row.original.isActive ? 'ok' : 'mut'}>
        {row.original.isActive ? 'Aktif' : 'Nonaktif'}
      </Pill>
    ),
    enableColumnFilter: true,
    meta: { label: 'Status', variant: 'multiSelect', options: STATUS_OPTIONS }
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: header('Diubah'),
    cell: ({ row }) => (
      <span className='text-sm whitespace-nowrap'>
        {dateFmt.format(new Date(row.original.updatedAt))}
      </span>
    )
  },
  { id: 'actions', cell: ({ row }) => <CellAction data={row.original} /> }
];
