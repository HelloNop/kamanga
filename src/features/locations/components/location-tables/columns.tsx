'use client';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { Pill } from '@/components/ui/pill';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { LocationRow } from '../../api/types';
import { LEVEL_LABELS, LEVEL_OPTIONS } from '../../constants';
import { CellAction } from './cell-action';

// id kolom = nama parameter URL (name, level) dan kunci urutan (name, level).
export const COLUMN_IDS = ['name', 'level', 'parent', 'aliases', 'coords', 'listings', 'actions'];

const header = (title: string) =>
  function Header({ column }: { column: Column<LocationRow, unknown> }) {
    return <DataTableColumnHeader column={column} title={title} />;
  };

const dash = <span className='text-muted-foreground'>-</span>;

export const columns: ColumnDef<LocationRow>[] = [
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
    id: 'level',
    accessorKey: 'level',
    header: header('Tingkat'),
    cell: ({ row }) => <Pill tone='mut'>{LEVEL_LABELS[row.original.level]}</Pill>,
    enableColumnFilter: true,
    meta: { label: 'Tingkat', variant: 'multiSelect', options: LEVEL_OPTIONS }
  },
  {
    id: 'parent',
    accessorKey: 'parentName',
    enableSorting: false,
    header: 'Induk',
    cell: ({ row }) => row.original.parentName ?? dash
  },
  {
    id: 'aliases',
    accessorKey: 'aliases',
    enableSorting: false,
    header: 'Sebutan lain',
    cell: ({ row }) => (
      <span className='block max-w-64 truncate'>{row.original.aliases ?? dash}</span>
    )
  },
  {
    id: 'coords',
    accessorKey: 'hasCoords',
    enableSorting: false,
    header: 'Koordinat',
    cell: ({ row }) =>
      row.original.hasCoords ? <Pill tone='ok'>Ada</Pill> : <Pill tone='mut'>Belum</Pill>
  },
  { id: 'listings', accessorKey: 'listingCount', enableSorting: false, header: 'Listing' },
  { id: 'actions', cell: ({ row }) => <CellAction data={row.original} /> }
];
