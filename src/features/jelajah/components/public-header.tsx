import Link from 'next/link';
import { ThemeToggle } from '@/features/chat/components/theme-toggle';

export function PublicHeader() {
  return (
    <header className='nav'>
      <Link className='brand' href='/chat' aria-label='Kamanga, beranda'>
        kamanga
      </Link>
      <div className='nav-right'>
        <Link className='link-quiet keep hide-sm' href='/chat'>
          Tanya Kamanga
        </Link>
        <Link className='link-quiet keep' href='/jelajah'>
          Jelajah
        </Link>
        <ThemeToggle />
        <Link className='cta' href='/auth/sign-up' aria-label='Daftarkan usaha'>
          <span className='cta-long'>Daftarkan usaha</span>
          <span className='cta-short' aria-hidden='true'>
            Daftar
          </span>
        </Link>
      </div>
    </header>
  );
}
