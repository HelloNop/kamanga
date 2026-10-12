'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { AlertModal } from '@/components/modal/alert-modal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { setListingStatusMutation } from '../../api/mutations';
import type { ListingRow } from '../../api/types';

export function CellAction({ data }: { data: ListingRow }) {
  const router = useRouter();
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Jangan menimpa `onSuccess` di dalam useMutation: itu akan menghapus penyegaran tabel
  // yang ada di setListingStatusMutation. Pakai callback per-panggilan agar keduanya jalan.
  const statusMutation = useMutation(setListingStatusMutation);
  const setStatus = (status: 'draft' | 'published' | 'archived') =>
    statusMutation.mutate(
      { id: data.id, status },
      {
        onSuccess: () => {
          toast.success(
            status === 'published'
              ? 'Listing diterbitkan'
              : status === 'archived'
                ? 'Listing diarsipkan'
                : 'Dikembalikan ke draf'
          );
          setConfirmArchive(false);
        },
        onError: (e) => toast.error(e.message)
      }
    );

  return (
    <>
      <AlertModal
        isOpen={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={() => setStatus('archived')}
        loading={statusMutation.isPending}
        title='Arsipkan listing ini?'
        description='Listing tidak akan tampil ke warga dan chatbot. Bisa dikembalikan ke draf kapan saja.'
        confirmLabel='Arsipkan'
      />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={<Button variant='ghost' className='size-7 p-0' />}>
          <span className='sr-only'>Buka menu</span>
          <Icons.ellipsis className='h-4 w-4' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Aksi</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/listings/${data.id}`)}>
              <Icons.edit className='mr-2 h-4 w-4' /> Ubah
            </DropdownMenuItem>
            {data.status !== 'published' && (
              <DropdownMenuItem onClick={() => setStatus('published')}>
                <Icons.circleCheck className='mr-2 h-4 w-4' /> Terbitkan
              </DropdownMenuItem>
            )}
            {data.status === 'archived' && (
              <DropdownMenuItem onClick={() => setStatus('draft')}>
                <Icons.edit className='mr-2 h-4 w-4' /> Kembalikan ke draf
              </DropdownMenuItem>
            )}
            {data.status !== 'archived' && (
              <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
                <Icons.trash className='mr-2 h-4 w-4' /> Arsipkan
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
