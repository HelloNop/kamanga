import Link from 'next/link';
import { Icons } from '@/components/icons';
import { getSession } from '@/lib/session';

/** Kepala halaman warga: garis marawa, merek, dan tautan Masuk atau Pesanan + Akun. */
export async function WargaHeader() {
  const session = await getSession();
  const citizen = session?.user.role === 'citizen';
  return (
    <>
      <div className='w-stripe' aria-hidden='true' />
      <header className='w-top'>
        <Link className='w-brand' href='/' aria-label='Kamanga, beranda'>
          kamanga<span aria-hidden='true'>.</span>
        </Link>
        <nav className='w-nav' aria-label='Akun'>
          {citizen ? (
            <>
              <Link href='/pesanan'>
                <Icons.receipt size={20} aria-hidden='true' />
                Pesanan
              </Link>
              <Link href='/akun'>
                <Icons.account size={20} aria-hidden='true' />
                Akun
              </Link>
            </>
          ) : session ? (
            <Link href='/dashboard'>Panel</Link>
          ) : (
            <Link href='/masuk'>
              <Icons.login size={20} aria-hidden='true' />
              Masuk
            </Link>
          )}
        </nav>
      </header>
    </>
  );
}
