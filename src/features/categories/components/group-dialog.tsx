'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { createGroupMutation, deleteGroupMutation, renameGroupMutation } from '../api/mutations';
import { categoryGroupsOptions } from '../api/queries';
import { GROUP_SUGGESTIONS } from '../constants';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Modal untuk membuat dan merapikan kelompok kategori.
 * Bila `onCreated` diisi (dipakai dari form kategori), modal menutup setelah kelompok dibuat
 * dan form langsung memilihnya.
 */
export function GroupDialog({
  open,
  onOpenChange,
  onCreated
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (group: { id: number; name: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        {/* Isi dipasang hanya saat modal terbuka: tidak ada query saat render di server. */}
        <GroupDialogBody onClose={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function GroupDialogBody({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated?: (group: { id: number; name: string }) => void;
}) {
  const { data } = useQuery(categoryGroupsOptions());
  const groups = data ?? [];
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const create = useMutation(createGroupMutation);
  const rename = useMutation(renameGroupMutation);
  const remove = useMutation(deleteGroupMutation);
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'Gagal menyimpan');

  const add = (value: string) => {
    if (create.isPending) return; // Enter ganda tidak membuat dua kali
    setError('');
    create.mutate(value, {
      onSuccess: (r) => {
        setName('');
        toast.success(`Kelompok "${r.name}" dibuat`);
        if (onCreated) {
          onCreated({ id: r.id, name: r.name });
          onClose();
        }
      },
      onError: fail
    });
  };

  const suggestions =
    groups.length < 6
      ? GROUP_SUGGESTIONS.filter((s) => !groups.some((g) => sameName(g.name, s)))
      : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tambah kelompok</DialogTitle>
        <DialogDescription>
          Rak besar untuk mengelompokkan kategori, mis. Kesehatan atau Acara &amp; Pernikahan.
        </DialogDescription>
      </DialogHeader>

      <form
        className='flex gap-2'
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add(name);
        }}
      >
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          maxLength={40}
          placeholder='Nama kelompok baru'
          aria-label='Nama kelompok baru'
          aria-invalid={!!error}
        />
        <Button type='submit' disabled={create.isPending || !name.trim()}>
          Tambah
        </Button>
      </form>
      {error && (
        <p role='alert' className='text-destructive -mt-2 text-xs'>
          {error}
        </p>
      )}

      {suggestions.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5'>
          <span className='text-muted-foreground text-xs'>Saran:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type='button'
              onClick={() => {
                setName(s);
                setError('');
              }}
              className='text-muted-foreground hover:text-foreground hover:bg-muted rounded-full border border-dashed px-2.5 py-0.5 text-xs transition-colors'
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className='text-muted-foreground mb-1.5 text-xs'>
          {groups.length ? `Kelompok yang ada (${groups.length})` : 'Belum ada kelompok.'}
        </p>
        {groups.length > 0 && (
          <ul className='max-h-64 divide-y overflow-y-auto rounded-lg border'>
            {groups.map((g) => (
              <li key={g.id} className='flex items-center gap-2 px-3 py-1.5 text-sm'>
                {editing?.id === g.id ? (
                  <form
                    className='flex flex-1 items-center gap-1'
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError('');
                      rename.mutate(
                        { id: g.id, name: editing.name },
                        { onSuccess: () => setEditing(null), onError: fail }
                      );
                    }}
                  >
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ id: g.id, name: e.target.value })}
                      maxLength={40}
                      aria-label={`Nama baru untuk ${g.name}`}
                      className='h-8'
                    />
                    <Button
                      type='submit'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label='Simpan nama'
                    >
                      <Icons.check className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label='Batal'
                      onClick={() => setEditing(null)}
                    >
                      <Icons.close className='size-4' />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className='min-w-0 flex-1 truncate'>{g.name}</span>
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {g.categoryCount} kategori
                    </span>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      aria-label={`Ubah nama ${g.name}`}
                      onClick={() => {
                        setError('');
                        setEditing({ id: g.id, name: g.name });
                      }}
                    >
                      <Icons.edit className='size-4' />
                    </Button>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      className='size-8'
                      disabled={g.categoryCount > 0 || remove.isPending}
                      title={
                        g.categoryCount > 0
                          ? 'Masih dipakai kategori, tidak bisa dihapus'
                          : 'Hapus kelompok'
                      }
                      aria-label={`Hapus ${g.name}`}
                      onClick={() => {
                        setError('');
                        remove.mutate(g.id, { onError: fail });
                      }}
                    >
                      <Icons.trash className='size-4' />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** Tombol di header halaman daftar kategori. */
export function AddGroupButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant='outline' className='text-xs md:text-sm' onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Tambah kelompok
      </Button>
      <GroupDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
