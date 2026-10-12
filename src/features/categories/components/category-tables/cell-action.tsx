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
import { deleteCategoryMutation, setCategoryActiveMutation } from '../../api/mutations';
import type { CategoryRow } from '../../api/types';

export function CellAction({ data }: { data: CategoryRow }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Callback per-panggilan (bukan onSuccess di useMutation) agar penyegaran tabel tetap jalan.
  const activeMutation = useMutation(setCategoryActiveMutation);
  const deleteMutation = useMutation(deleteCategoryMutation);

  const toggleActive = () =>
    activeMutation.mutate(
      { id: data.id, isActive: !data.isActive },
      {
        onSuccess: () =>
          toast.success(data.isActive ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan'),
        onError: (e) => toast.error(e.message)
      }
    );
  const remove = () =>
    deleteMutation.mutate(data.id, {
      onSuccess: () => {
        toast.success('Kategori dihapus');
        setConfirmDelete(false);
      },
      onError: (e) => {
        toast.error(e.message);
        setConfirmDelete(false);
      }
    });

  return (
    <>
      <AlertModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={deleteMutation.isPending}
        title='Hapus kategori ini?'
        description='Kategori yang masih dipakai listing tidak bisa dihapus; nonaktifkan saja.'
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
            <DropdownMenuItem onClick={() => router.push(`/dashboard/categories/${data.id}`)}>
              <Icons.edit className='mr-2 h-4 w-4' /> Ubah
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleActive}>
              <Icons.circleCheck className='mr-2 h-4 w-4' />{' '}
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
