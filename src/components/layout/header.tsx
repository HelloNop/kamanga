import React from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { UserMenu } from './user-menu';

// Panel melayang di atas konten; di ponsel tombol menu membuka sidebar sebagai lembar geser.
export default function Header() {
  return (
    <header className='bg-muted flex h-[68px] shrink-0 items-center gap-3 rounded-3xl px-4'>
      <SidebarTrigger className='-ml-1' />
      <Separator orientation='vertical' className='mr-1 h-4 data-vertical:self-center' />
      {/* Seperti prototipe: pencarian di kiri. Di layar sempit pencarian disembunyikan dan jejak halaman tampil. */}
      <div className='hidden max-w-[380px] flex-1 md:block'>
        <SearchInput />
      </div>
      <div className='min-w-0 flex-1 md:hidden'>
        <Breadcrumbs />
      </div>
      <div className='ml-auto flex shrink-0 items-center gap-3'>
        <ThemeModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
