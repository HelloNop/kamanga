import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from '@/lib/auth';

// Pemeriksaan sesi yang sebenarnya (cek database). Proxy hanya mengecek keberadaan cookie.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  return session;
}

// Panel /dashboard: hanya admin dan mitra. Warga diarahkan ke beranda.
export async function requireStaff() {
  const session = await requireSession();
  if (session.user.role === 'citizen') redirect('/');
  return session;
}

// Untuk halaman warga (pesanan, akun). Belum masuk sebagai warga → halaman masuk OTP WA.
// Di server action, pakai getSession() dan kembalikan galat alih-alih redirect.
export async function requireCitizen(next = '/') {
  const session = await getSession();
  if (!session || session.user.role !== 'citizen')
    redirect(`/masuk?next=${encodeURIComponent(next)}`);
  return session;
}

// Untuk halaman dan aksi khusus admin. Selalu panggil juga di server action / route handler.
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== 'admin') redirect('/dashboard/overview');
  return session;
}

// Untuk halaman dan aksi vendor (pemilik usaha). Admin memakai layar admin, bukan portal vendor.
export async function requireVendor() {
  const session = await requireSession();
  if (session.user.role !== 'vendor') redirect('/dashboard/overview');
  return session;
}
