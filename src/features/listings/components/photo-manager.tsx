'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { vendorKeys } from '@/features/vendor/api/queries';
import { listingKeys } from '../api/queries';
import type { PhotoItem } from '../api/types';
import { MAX_PHOTOS } from '../constants/listing-options';

type State = { photos: PhotoItem[]; pending: PhotoItem[] };

/**
 * Foto listing. Berjalan sendiri (langsung ke /api/photos), tidak ikut tombol simpan formulir,
 * jadi hanya tersedia setelah listing punya id.
 */
export function PhotoManager({
  listingId,
  initial,
  isVendor
}: {
  listingId: number;
  initial: State;
  isVendor: boolean;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(initial);
  const [busy, setBusy] = useState(false);
  const total = state.photos.length + state.pending.length;

  const call = async (init: RequestInit) => {
    const res = await fetch('/api/photos', init);
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) throw new Error(body?.message ?? 'Gagal memproses foto');
    setState({ photos: body.photos, pending: body.pending });
    qc.invalidateQueries({ queryKey: listingKeys.detail(listingId) });
    qc.invalidateQueries({ queryKey: vendorKeys.detail(listingId) });
  };
  const json = (method: string, key: string) => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ listingId, key })
  });
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memproses foto');
    } finally {
      setBusy(false);
    }
  };

  const upload = (files: FileList | null) =>
    run(async () => {
      const room = MAX_PHOTOS - total;
      const list = Array.from(files ?? []).slice(0, Math.max(room, 0));
      for (const file of list) {
        const body = new FormData();
        body.set('listingId', String(listingId));
        body.set('file', file);
        await call({ method: 'POST', body });
      }
      if (list.length)
        toast.success(
          isVendor ? 'Foto dikirim. Tampil setelah disetujui tim.' : 'Foto ditambahkan'
        );
      if (input.current) input.current.value = '';
    });

  const tile = (p: PhotoItem, i: number, pending: boolean) => (
    <li key={p.key} className='bg-muted relative aspect-[4/3] overflow-hidden rounded-xl'>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.url} alt='' className='size-full object-cover' />
      <span className='absolute top-2 left-2 flex gap-1.5'>
        {pending ? (
          <span className='rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white'>
            Menunggu review
          </span>
        ) : (
          i === 0 && (
            <span className='bg-foreground text-background rounded-full px-2 py-0.5 text-xs font-semibold'>
              Sampul
            </span>
          )
        )}
      </span>
      <span className='absolute right-2 bottom-2 left-2 flex justify-between gap-1.5'>
        {!pending && i > 0 ? (
          <button
            type='button'
            disabled={busy}
            onClick={() => run(() => call(json('PATCH', p.key)))}
            className='bg-background/90 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm'
          >
            Jadikan sampul
          </button>
        ) : (
          <span />
        )}
        <button
          type='button'
          disabled={busy}
          aria-label='Hapus foto'
          onClick={() => run(() => call(json('DELETE', p.key)))}
          className='bg-background/90 grid size-7 place-items-center rounded-full shadow-sm'
        >
          <Icons.trash className='size-3.5' />
        </button>
      </span>
    </li>
  );

  return (
    <div className='space-y-3'>
      {total > 0 && (
        <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {state.photos.map((p, i) => tile(p, i, false))}
          {state.pending.map((p, i) => tile(p, i, true))}
        </ul>
      )}
      <div className='flex flex-wrap items-center gap-3'>
        <input
          ref={input}
          type='file'
          aria-label='Pilih foto'
          accept='image/jpeg,image/png,image/webp'
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          type='button'
          variant='outline'
          disabled={busy || total >= MAX_PHOTOS}
          onClick={() => input.current?.click()}
        >
          <Icons.upload className='mr-1.5 size-4' />
          {busy ? 'Mengunggah…' : 'Tambah foto'}
        </Button>
        <span className='text-muted-foreground text-[0.8125rem]'>
          {total}/{MAX_PHOTOS} foto · JPG, PNG, atau WebP, maksimal 5 MB
        </span>
      </div>
    </div>
  );
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

/** Unggah beberapa berkas ke listing yang baru dibuat. Mengembalikan jumlah yang gagal. */
export async function uploadPhotos(listingId: number, files: File[]) {
  let failed = 0;
  for (const file of files) {
    const body = new FormData();
    body.set('listingId', String(listingId));
    body.set('file', file);
    try {
      const res = await fetch('/api/photos', { method: 'POST', body });
      if (!res.ok) failed++;
    } catch {
      failed++;
    }
  }
  return failed;
}

/** Foto untuk listing yang belum disimpan: dipilih sekarang, diunggah setelah listing dibuat. */
export function StagedPhotos({
  files,
  onChange,
  isVendor
}: {
  files: File[];
  onChange: (files: File[]) => void;
  isVendor: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const ok = picked.filter((f) => ALLOWED.includes(f.type) && f.size <= MAX_BYTES);
    if (ok.length < picked.length)
      toast.error('Sebagian foto dilewati: harus JPG, PNG, atau WebP, maksimal 5 MB');
    onChange([...files, ...ok].slice(0, MAX_PHOTOS));
    if (input.current) input.current.value = '';
  };

  return (
    <div className='space-y-3'>
      {files.length > 0 && (
        <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className='bg-muted relative aspect-[4/3] overflow-hidden rounded-xl'
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt='' className='size-full object-cover' />
              {i === 0 && (
                <span className='bg-foreground text-background absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-semibold'>
                  Sampul
                </span>
              )}
              <button
                type='button'
                aria-label='Buang foto'
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className='bg-background/90 absolute right-2 bottom-2 grid size-7 place-items-center rounded-full shadow-sm'
              >
                <Icons.trash className='size-3.5' />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className='flex flex-wrap items-center gap-3'>
        <input
          ref={input}
          type='file'
          aria-label='Pilih foto'
          accept={ALLOWED.join(',')}
          multiple
          hidden
          onChange={(e) => add(e.target.files)}
        />
        <Button
          type='button'
          variant='outline'
          disabled={files.length >= MAX_PHOTOS}
          onClick={() => input.current?.click()}
        >
          <Icons.upload className='mr-1.5 size-4' />
          Tambah foto
        </Button>
        <span className='text-muted-foreground text-[0.8125rem]'>
          {files.length}/{MAX_PHOTOS} foto · diunggah saat listing disimpan
          {isVendor && ' · diperiksa tim sebelum tampil'}
        </span>
      </div>
    </div>
  );
}
