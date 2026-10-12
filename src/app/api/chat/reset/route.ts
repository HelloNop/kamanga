import { cookies } from 'next/headers';
import { sameOrigin, SESSION_COOKIE } from '@/lib/kamanga-ai/request';

// "Percakapan baru": lepaskan cookie sesi. Pesan berikutnya membuat sesi baru (riwayat dan lokasi lama tidak terbawa).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  (await cookies()).delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
