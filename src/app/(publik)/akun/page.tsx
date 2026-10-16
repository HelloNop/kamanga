// Akun warga (PRD 8.7): nama, nomor (disamarkan), alamat tersimpan, keluar, hapus akun.
import type { Metadata } from 'next';
import Link from 'next/link';
import { getCitizenProfile, listSavedAddresses } from '@/features/warga/api/repository';
import { DeleteAccount, SavedAddresses, SignOut } from '@/features/warga/components/account';
import { PublicHeader } from '@/features/jelajah/components/public-header';
import { maskPhone } from '@/features/warga/lib/format';
import { paths } from '@/lib/engines/contracts';
import { requireCitizen } from '@/lib/session';

export const metadata: Metadata = { title: 'Akun' };

export default async function AccountPage() {
  const session = await requireCitizen('/akun');
  const [profile, addresses] = await Promise.all([
    getCitizenProfile(session.user.id),
    listSavedAddresses(session.user.id)
  ]);
  return (
    <div className='kmg warga'>
      <PublicHeader />
      <main className='w-main'>
        <h1 className='w-title'>Akun</h1>
        {!profile?.privacyConsentAt && (
          <p className='w-alert info'>
            Akunmu belum lengkap. <Link href={paths.citizenSignIn('/akun')}>Lengkapi sekarang</Link>
            .
          </p>
        )}
        <dl className='w-dl w-box'>
          <div>
            <dt>Nama panggilan</dt>
            <dd>{profile?.name}</dd>
          </div>
          <div>
            <dt>Nomor WhatsApp</dt>
            <dd>{maskPhone(profile?.phone)}</dd>
          </div>
        </dl>
        <p style={{ marginTop: 12 }}>
          <Link href={paths.citizenBookings()}>Lihat pesanan saya</Link>
        </p>

        <h2 className='w-h2'>Alamat tersimpan</h2>
        <SavedAddresses
          items={addresses.map((a) => ({
            id: a.id,
            label: a.label,
            address: a.address,
            place: a.locationName,
            hasPoint: a.hasPoint
          }))}
        />

        <h2 className='w-h2'>Lainnya</h2>
        <div className='w-actions' style={{ marginTop: 0 }}>
          <SignOut />
          <DeleteAccount />
        </div>
      </main>
    </div>
  );
}
