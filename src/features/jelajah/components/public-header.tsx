import Link from 'next/link';
import { ThemeToggle } from '@/features/chat/components/theme-toggle';
import { getSession, isCitizen } from '@/lib/session';

/** Header halaman publik dan warga (di dalam .kmg), sama dengan header beranda: tema, Jelajah, Masuk/Akun, mitra. */
export async function PublicHeader() {
  const session = await getSession();
  return (
    <header className='nav'>
      <Link className='brand' href='/' aria-label='Kamanga, beranda'>
        kamanga
      </Link>
      <div className='nav-right'>
        <ThemeToggle />
        <Link className='link-quiet keep' href='/jelajah'>
          Jelajah
        </Link>
        {isCitizen(session) ? (
          <Link className='link-quiet keep' href='/akun'>
            Akun
          </Link>
        ) : session ? (
          <Link className='link-quiet keep' href='/dashboard'>
            Panel
          </Link>
        ) : (
          <Link className='link-quiet keep' href='/masuk'>
            Masuk
          </Link>
        )}
        <Link className='cta' href='/auth/sign-up' aria-label='Daftarkan usaha'>
          <span className='cta-long'>Daftarkan usaha</span>
          <span className='cta-short' aria-hidden='true'>
            Mitra
          </span>
        </Link>
      </div>
    </header>
  );
}
