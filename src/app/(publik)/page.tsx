// Beranda "Kamanga hari ko?" (PRD 8.1). Pintu, urutan, ikon, dan status dari tabel doors (diatur admin).
// Tanpa akun dan tanpa AI: kolom ketik bebas hanya meneruskan ke /chat.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import { getHomeDoors } from '@/features/warga/api/repository';
import { WargaHeader } from '@/features/warga/components/header';
import { RotatingText } from '@/features/warga/components/rotating-text';
import { paths } from '@/lib/engines/contracts';

export const metadata: Metadata = { title: { absolute: 'Kamanga hari ko?' } };

export default async function Home() {
  const doors = await getHomeDoors();
  const active = doors.filter((d) => d.status === 'active');
  const rotating = active.map((d) => d.rotatingText || `${d.name.toLowerCase()}…`);
  return (
    <div className='warga'>
      <WargaHeader />
      <main className='w-main'>
        <section className='w-hero'>
          <h1>Kamanga hari ko?</h1>
          <RotatingText items={rotating} />
          <p className='sr-only'>Pilih kebutuhanmu: {active.map((d) => d.name).join(', ')}.</p>
        </section>

        <ul className='w-doors' aria-label='Pintu layanan'>
          {doors.map((d) => {
            const Icon = Icons[d.icon as keyof typeof Icons] ?? Icons.door;
            const body = (
              <>
                <span className='w-door-icon' aria-hidden='true'>
                  <Icon size={24} />
                </span>
                <b>{d.name}</b>
                {d.description && <small>{d.description}</small>}
              </>
            );
            return (
              <li key={d.slug}>
                {d.status === 'active' ? (
                  <Link className='w-door' href={paths.door(d.slug)}>
                    {body}
                  </Link>
                ) : (
                  <div className='w-door is-soon' aria-disabled='true'>
                    {body}
                    <span className='w-badge'>Segera</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <form className='w-ask' action='/chat' method='get' role='search'>
          <label htmlFor='w-ask'>Atau ceritakan saja…</label>
          <div className='w-ask-row'>
            <input
              id='w-ask'
              aria-label='Atau ceritakan saja…'
              name='q'
              type='text'
              maxLength={500}
              placeholder='mis. AC rumah ndak dingin, di Kuranji'
              autoComplete='off'
              required
            />
            <button className='w-btn small' type='submit'>
              <Icons.send size={18} aria-hidden='true' />
              <span>Kirim</span>
            </button>
          </div>
        </form>

        <nav className='w-foot' aria-label='Tautan lain'>
          <Link href='/jelajah'>Jelajah semua usaha</Link>
          <Link href='/auth/sign-up'>Daftarkan usaha</Link>
        </nav>
      </main>
    </div>
  );
}
