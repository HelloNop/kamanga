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
