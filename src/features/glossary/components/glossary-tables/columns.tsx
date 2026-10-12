'use client';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Pill } from '@/components/ui/pill';
import type { GlossaryRow } from '../../api/types';
import { CHECK_OPTIONS } from '../../constants';
import { CellAction } from './cell-action';

// id kolom = nama parameter URL (term, status) dan kunci urutan (term, meaning, updatedAt).
export const COLUMN_IDS = ['term', 'meaning', 'status', 'updatedAt', 'actions'];

const dateFmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });

const header = (title: string) =>
  function Header({ column }: { column: Column<GlossaryRow, unknown> }) {
    return <DataTableColumnHeader column={column} title={title} />;
  };

export const columns: ColumnDef<GlossaryRow>[] = [
  {
    id: 'term',
    accessorKey: 'term',
    header: header('Kata'),
    cell: ({ row }) => <span className='font-semibold'>{row.original.term}</span>,
    meta: {
      label: 'Kata',
      placeholder: 'Cari kata atau arti...',
      variant: 'text',
      icon: Icons.text
    },
    enableColumnFilter: true
  },
  {
    id: 'meaning',
    accessorKey: 'meaning',
    header: header('Artinya'),
    cell: ({ row }) => <span className='block max-w-72 truncate'>{row.original.meaning}</span>
  },
  {
    id: 'status',
    accessorKey: 'isChecked',
    enableSorting: false,
    header: 'Status',
    cell: ({ row }) =>
      row.original.isChecked ? (
        <Pill tone='ok'>Sudah dicek</Pill>
      ) : (
        <Pill tone='warn'>Perlu dicek</Pill>
      ),
    enableColumnFilter: true,
    meta: { label: 'Status', variant: 'multiSelect', options: CHECK_OPTIONS }
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
