'use client';
import { useKBar } from 'kbar';
import { Icons } from '@/components/icons';
import { Button } from './ui/button';

export default function SearchInput() {
  const { query } = useKBar();
  return (
    <div className='w-full space-y-2'>
      <Button
        variant='ghost'
        className='bg-card text-muted-foreground hover:bg-card hover:text-foreground relative h-11 w-full justify-start px-4 text-sm font-normal shadow-xs sm:pr-14'
        onClick={query.toggle}
      >
        <Icons.search className='mr-2 h-4 w-4' />
        Cari menu...
        <kbd className='bg-muted pointer-events-none absolute top-1/2 right-3 hidden h-6 -translate-y-1/2 items-center gap-1 rounded-lg px-2 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
          <span className='text-xs'>⌘</span>K
        </kbd>
      </Button>
    </div>
  );
}
