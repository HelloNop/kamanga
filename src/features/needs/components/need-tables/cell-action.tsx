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
import { deleteNeedMutation, setNeedActiveMutation } from '../../api/mutations';
import type { NeedRow } from '../../api/types';

export function CellAction({ data }: { data: NeedRow }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteMutation = useMutation(deleteNeedMutation);
  const activeMutation = useMutation(setNeedActiveMutation);

  // Callback per-panggilan (bukan onSuccess di useMutation) agar penyegaran tabel tetap jalan.
  const remove = () =>
    deleteMutation.mutate(data.id, {
      onSuccess: () => {
        toast.success('Kebutuhan dihapus');
        setConfirmDelete(false);
      },
      onError: (e) => {
        toast.error(e.message);
        setConfirmDelete(false);
      }
    });
  const toggleActive = () =>
    activeMutation.mutate(
      { id: data.id, isActive: !data.isActive },
      {
        onSuccess: () =>
          toast.success(data.isActive ? 'Kebutuhan dinonaktifkan' : 'Kebutuhan diaktifkan'),
        onError: (e) => toast.error(e.message)
      }
    );

  return (
    <>
      <AlertModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleteMutation.isPending}
        title='Hapus kebutuhan ini?'
        description='Sebutan lain dan tautan ke kategorinya ikut terhapus. Kategori dan listing tidak terpengaruh.'
        confirmLabel='Hapus'
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
            <DropdownMenuItem onClick={() => router.push(`/dashboard/needs/${data.id}`)}>
              <Icons.edit className='mr-2 h-4 w-4' /> Ubah
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleActive}>
              <Icons.circleCheck className='mr-2 h-4 w-4' />
              {data.isActive ? 'Nonaktifkan' : 'Aktifkan'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmDelete(true)}>
              <Icons.trash className='mr-2 h-4 w-4' /> Hapus
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
