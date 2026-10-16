// Chat pindah ke beranda. Alamat lama tetap jalan: /chat?q=... diteruskan ke /?q=...
import { redirect } from 'next/navigation';
import { paths } from '@/lib/engines/paths';

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const q = (await searchParams).q;
  redirect(paths.chat((Array.isArray(q) ? q[0] : q)?.trim() || undefined));
}
