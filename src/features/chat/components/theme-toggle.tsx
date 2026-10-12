'use client';
import { useTheme } from 'next-themes';
import { Icons } from '@/components/icons';
import { startThemeTransition } from '@/lib/theme-transition';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <button
      type='button'
      className='icon-btn'
      aria-label='Ganti tema terang atau gelap'
      title='Ganti tema terang atau gelap'
      onClick={(e) =>
        startThemeTransition(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'), e)
      }
    >
      <Icons.moon className='moon' aria-hidden='true' />
      <Icons.sun className='sun' aria-hidden='true' />
    </button>
  );
}
