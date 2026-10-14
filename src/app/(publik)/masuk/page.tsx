// Masuk warga dengan nomor WhatsApp + OTP (PRD 8.7). Setelah masuk kembali ke `next` (hanya jalur internal).
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCitizenProfile } from '@/features/warga/api/repository';
import { WargaHeader } from '@/features/warga/components/header';
import { SignIn } from '@/features/warga/components/sign-in';
import { safeNext } from '@/features/warga/lib/format';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Masuk' };

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  const session = await getSession();
  const citizen = session?.user.role === 'citizen';
  // Warga yang sudah lengkap langsung kembali; yang belum setuju privasi lanjut ke langkah profil.
  const profile = citizen ? await getCitizenProfile(session.user.id) : null;
  if (profile?.privacyConsentAt) redirect(next);

  return (
    <div className='warga'>
      <WargaHeader />
      <main className='w-main'>
        <h1 className='w-title'>Masuk</h1>
        <p className='w-lead'>Cukup nomor WhatsApp. Tanpa sandi.</p>
        {session && !citizen ? (
          <p className='w-alert info'>
            Kamu sedang masuk sebagai pengelola usaha atau tim Kamanga. Keluar dulu dari{' '}
            <Link href='/dashboard'>panel</Link> untuk masuk sebagai warga.
          </p>
        ) : (
          <SignIn
            next={next}
            devHint={process.env.NODE_ENV !== 'production'}
            initialStep={citizen ? 'profile' : 'phone'}
          />
        )}
      </main>
    </div>
  );
}
