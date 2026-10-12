'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Pengganti tombol berkas bawaan peramban (yang berbahasa Inggris dan tidak seragam).
export function FilePicker({
  accept,
  label = 'Pilih berkas',
  onFile
}: {
  accept?: string;
  label?: string;
  onFile: (file: File | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  return (
    <div className='flex items-center gap-3 text-sm'>
      <input
        ref={ref}
        type='file'
        accept={accept}
        className='sr-only'
        tabIndex={-1}
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          setName(file?.name ?? '');
          onFile(file);
        }}
      />
      <Button type='button' variant='outline' size='sm' onClick={() => ref.current?.click()}>
        {label}
      </Button>
      <span className='text-muted-foreground truncate'>{name || 'Belum ada berkas dipilih'}</span>
    </div>
  );
}
