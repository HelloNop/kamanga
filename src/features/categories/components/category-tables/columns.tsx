'use client';
import type { Column, ColumnDef } from '@tanstack/react-table';
import { Icons } from '@/components/icons';
import { Pill } from '@/components/ui/pill';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { CategoryRow } from '../../api/types';
import { SCHEDULE_KIND_LABELS, type ScheduleKindValue } from '../../constants';
import { CellAction } from './cell-action';

// id kolom = nama parameter URL (name, group) dan kunci urutan (name, group, sortOrder).
export const COLUMN_IDS = [
  'name',
  'group',
  'door',
  'rules',
  'sortOrder',
  'attributes',
  'listings',
  'active',
  'actions'
];

const header = (title: string) =>
  function Header({ column }: { column: Column<CategoryRow, unknown> }) {
    return <DataTableColumnHeader column={column} title={title} />;
  };

export function getColumns(
  groupOptions: { value: string; label: string }[]
): ColumnDef<CategoryRow>[] {
  return [
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
        placeholder: 'Cari nama atau slug...',
        variant: 'text',
        icon: Icons.text
      },
      enableColumnFilter: true
    },
    {
      id: 'group',
      accessorKey: 'group',
      header: header('Kelompok'),
      cell: ({ row }) => (
        <div className='flex flex-wrap gap-1'>
          <Pill tone='info'>{row.original.group}</Pill>
          {row.original.extraGroups.map((g) => (
            <Pill key={g} tone='mut'>
              {g}
            </Pill>
          ))}
        </div>
      ),
      enableColumnFilter: true,
      meta: { label: 'Kelompok', variant: 'multiSelect', options: groupOptions }
    },
    {
      id: 'door',
      enableSorting: false,
      header: 'Pintu & jadwal',
      cell: ({ row }) => (
        <div className='min-w-32'>
          <div className={row.original.door ? 'font-medium' : 'text-muted-foreground'}>
            {row.original.door ?? 'Tanpa pintu'}
          </div>
          <div className='text-muted-foreground text-xs'>
            {SCHEDULE_KIND_LABELS[row.original.scheduleKind as ScheduleKindValue]}
          </div>
        </div>
      )
    },
    {
      id: 'rules',
      enableSorting: false,
      header: 'Aturan',
      cell: ({ row }) => {
        const tags = [
          !row.original.needsLocation && 'Tanpa lokasi',
          row.original.infoOnly && 'Info saja'
        ].filter(Boolean) as string[];
        return tags.length ? (
          <div className='flex gap-1'>
            {tags.map((t) => (
              <Pill key={t} tone='mut'>
                {t}
              </Pill>
            ))}
          </div>
        ) : (
          <span className='text-muted-foreground'>-</span>
        );
      }
    },
    { id: 'sortOrder', accessorKey: 'sortOrder', header: header('Urutan') },
    {
      id: 'attributes',
      accessorKey: 'attributeCount',
      enableSorting: false,
      header: 'Isian khusus',
      cell: ({ row }) =>
        row.original.attributeCount || <span className='text-muted-foreground'>-</span>
    },
    { id: 'listings', accessorKey: 'listingCount', enableSorting: false, header: 'Listing' },
    {
      id: 'active',
      accessorKey: 'isActive',
      enableSorting: false,
      header: 'Status',
      cell: ({ row }) => (
        <Pill tone={row.original.isActive ? 'ok' : 'mut'}>
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </Pill>
      )
    },
    { id: 'actions', cell: ({ row }) => <CellAction data={row.original} /> }
  ];
}
