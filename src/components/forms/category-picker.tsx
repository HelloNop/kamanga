'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Chip } from '@/components/forms/chip';
import { cn } from '@/lib/utils';

export type PickableCategory = { id: number; name: string; group: string | null };

/** Pilihan kategori berbentuk pil, dikelompokkan per kelompok, dengan pencarian bila banyak. */
export function CategoryPicker({
  categories,
  isOn,
  isDisabled,
  onPick,
  invalid
}: {
  categories: PickableCategory[];
  isOn: (id: number) => boolean;
  isDisabled?: (id: number) => boolean;
  onPick: (id: number) => void;
  invalid?: boolean;
}) {
  const [q, setQ] = useState('');
  if (categories.length === 0)
    return (
      <p className='text-muted-foreground text-sm'>
        Belum ada kategori.{' '}
        <Link
          href='/dashboard/categories/new'
          className='text-primary underline underline-offset-4'
        >
          Buat kategori dulu
        </Link>
        , lalu kembali ke sini.
      </p>
    );

  const term = q.trim().toLowerCase();
  const shown = term
    ? categories.filter(
        (c) =>
          isOn(c.id) ||
          c.name.toLowerCase().includes(term) ||
          (c.group ?? '').toLowerCase().includes(term)
      )
    : categories;
  const grouped = new Map<string, PickableCategory[]>();
  for (const c of shown)
    grouped.set(c.group ?? 'Lainnya', [...(grouped.get(c.group ?? 'Lainnya') ?? []), c]);

  return (
    <div className={cn('space-y-3', invalid && 'ring-destructive/50 rounded-xl p-1.5 ring-1')}>
      {categories.length > 8 && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Cari kategori…'
          aria-label='Cari kategori'
          className='placeholder:text-muted-foreground h-9 w-full max-w-60 rounded-full border-[1.5px] border-dashed bg-transparent px-4 text-sm outline-none focus-visible:border-solid'
        />
      )}
      {shown.length === 0 && (
        <p className='text-muted-foreground text-sm'>Tidak ada kategori yang cocok.</p>
      )}
      {[...grouped].map(([group, items]) => (
        <div key={group}>
          {categories.some((c) => c.group !== categories[0]?.group) && (
            <div className='text-muted-foreground mb-1.5 text-[0.6875rem] font-semibold tracking-wider uppercase'>
              {group}
            </div>
          )}
          <div className='flex flex-wrap gap-2'>
            {items.map((c) => {
              const on = isOn(c.id);
              return (
                <Chip key={c.id} on={on} disabled={isDisabled?.(c.id)} onClick={() => onPick(c.id)}>
                  {c.name}
                </Chip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
