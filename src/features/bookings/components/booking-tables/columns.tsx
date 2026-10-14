'use client';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import type { BookingRow } from '../../api/types';
import { BOOKING_STATUSES, STATUS_LABELS, STATUS_TONES, whenText } from '../../lib/status';

// id kolom = nama parameter URL (listing, when, status, flag).
const created = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

export const columns: ColumnDef<BookingRow>[] = [
  {
    id: 'code',
    header: 'Kode',
    enableSorting: false,
    cell: ({ row }) => (
      <div className='min-w-24'>
        <Link
          href={`/dashboard/bookings/${row.original.id}`}
          className='font-mono font-semibold underline-offset-4 hover:underline'
        >
          {row.original.code}
        </Link>
        <div className='text-muted-foreground text-xs'>
          {created.format(new Date(row.original.createdAt))}
        </div>
      </div>
    )
  },
  {
    id: 'listing',
    header: 'Penyedia',
    enableSorting: false,
    cell: ({ row }) => (
      <div className='min-w-44'>
        <div className='font-medium'>{row.original.listing.name}</div>
        <div className='text-muted-foreground text-xs'>{row.original.category.name}</div>
      </div>
    ),
    enableColumnFilter: true,
    meta: {
      label: 'Penyedia',
      placeholder: 'Cari nama penyedia...',
      variant: 'text',
      icon: Icons.text
    }
  },
  {
    id: 'when',
    header: 'Jadwal',
    enableSorting: false,
    cell: ({ row }) => (
      <div className='min-w-40 text-sm'>
        {whenText(row.original)}
        {row.original.seats > 1 && (
          <span className='text-muted-foreground'> · {row.original.seats} orang</span>
        )}
      </div>
    ),
    enableColumnFilter: true,
    meta: { label: 'Tanggal', variant: 'dateRange' }
  },
  {
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (
      <Pill tone={STATUS_TONES[row.original.status]}>{STATUS_LABELS[row.original.status]}</Pill>
    ),
    enableColumnFilter: true,
    meta: {
      label: 'Status',
      variant: 'multiSelect',
      options: BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))
    }
  },
  {
    id: 'flag',
    header: 'Perlu tindakan',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.stuck ? (
        <Pill tone='bad'>{row.original.stuck}</Pill>
      ) : (
        <span className='text-muted-foreground'>-</span>
      ),
    enableColumnFilter: true,
    meta: { label: 'Macet', variant: 'select', options: [{ value: 'stuck', label: 'Macet saja' }] }
  },
  {
    id: 'district',
    header: 'Kecamatan',
    enableSorting: false,
    cell: ({ row }) => row.original.district ?? <span className='text-muted-foreground'>-</span>
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Link
        href={`/dashboard/bookings/${row.original.id}`}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        Detail
      </Link>
    )
  }
];
