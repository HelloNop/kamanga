'use client';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { InitialAvatar } from '@/components/ui/initial-avatar';
import { Pill, type PillTone } from '@/components/ui/pill';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import {
  KIND_LABELS,
  KIND_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  VERIFICATION_LABELS,
  VERIFICATION_OPTIONS,
  type ListingStatus,
  type VerificationLevel
} from '../../constants/listing-options';
import type { ListingRow } from '../../api/types';
import { CellAction } from './cell-action';

// id kolom = nama parameter URL (name, kind, category, status, verification) dan kunci urutan (name, status, updatedAt).
export const COLUMN_IDS = [
  'name',
  'kind',
  'category',
  'status',
  'verification',
  'location',
  'updatedAt',
  'actions'
];

const STATUS_TONE: Record<ListingStatus, PillTone> = {
  published: 'ok',
  pending_review: 'warn',
  draft: 'mut',
  rejected: 'bad',
  archived: 'mut'
};
const VERIFICATION_TONE: Record<VerificationLevel, PillTone> = {
  visited: 'info',
  contact_checked: 'ok',
  unverified: 'mut'
};

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

const header = (title: string) =>
  function Header({ column }: { column: Column<ListingRow, unknown> }) {
    return <DataTableColumnHeader column={column} title={title} />;
  };

export function getColumns(
  categoryOptions: { value: string; label: string }[]
): ColumnDef<ListingRow>[] {
  return [
    {
      id: 'name',
      accessorKey: 'name',
      header: header('Nama'),
      cell: ({ row }) => (
        <div className='flex min-w-52 items-center gap-3'>
          <InitialAvatar name={row.original.name} seed={row.original.categoryName} />
          <div className='min-w-0'>
            <div className='truncate font-semibold'>{row.original.name}</div>
            <div className='text-muted-foreground truncate text-xs'>{row.original.slug}</div>
          </div>
        </div>
      ),
      meta: {
        label: 'Nama',
        placeholder: 'Cari nama atau slug...',
        variant: 'text',
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      id: 'kind',
      accessorKey: 'kind',
      enableSorting: false,
      header: header('Jenis'),
      cell: ({ row }) => (
        <Pill tone={row.original.kind === 'place' ? 'info' : 'mut'}>
          {KIND_LABELS[row.original.kind]}
        </Pill>
      ),
      enableColumnFilter: true,
      meta: { label: 'Jenis', variant: 'multiSelect', options: KIND_OPTIONS }
    },
    {
      id: 'category',
      accessorKey: 'categoryName',
      enableSorting: false,
      header: header('Kategori'),
      cell: ({ row }) =>
        row.original.categoryName ?? <span className='text-muted-foreground'>-</span>,
      enableColumnFilter: true,
      meta: { label: 'Kategori', variant: 'multiSelect', options: categoryOptions }
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: header('Status'),
      cell: ({ row }) => (
        <Pill tone={STATUS_TONE[row.original.status]}>{STATUS_LABELS[row.original.status]}</Pill>
      ),
      enableColumnFilter: true,
      meta: { label: 'Status', variant: 'multiSelect', options: STATUS_OPTIONS }
    },
    {
      id: 'verification',
      accessorKey: 'verificationLevel',
      enableSorting: false,
      header: header('Verifikasi'),
      cell: ({ row }) => (
        <Pill tone={VERIFICATION_TONE[row.original.verificationLevel]}>
          {VERIFICATION_LABELS[row.original.verificationLevel]}
        </Pill>
      ),
      enableColumnFilter: true,
      meta: { label: 'Verifikasi', variant: 'multiSelect', options: VERIFICATION_OPTIONS }
    },
    {
      id: 'location',
      accessorKey: 'locationName',
      enableSorting: false,
      header: header('Lokasi'),
      cell: ({ row }) =>
        row.original.locationName ?? <span className='text-muted-foreground'>-</span>
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
}
