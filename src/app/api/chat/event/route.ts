import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { chatEvents, listings } from '@/db/schema';
import { sessionExists } from '@/lib/kamanga-ai/chat-store';
import { sameOrigin, SESSION_COOKIE } from '@/lib/kamanga-ai/request';

// Mencatat klik kontak: bahan ukuran sukses v1. Hanya untuk sesi yang sudah ada dan listing yang terbit.
const TYPES = new Set(['whatsapp_click']);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  const body = (await req.json().catch(() => null)) as {
    type?: unknown;
    listingId?: unknown;
  } | null;
  const type = typeof body?.type === 'string' ? body.type : '';
  const listingId = Number(body?.listingId);
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!TYPES.has(type) || !Number.isInteger(listingId) || !(await sessionExists(sid)))
    return new Response(null, { status: 204 });

  const [l] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), eq(listings.status, 'published')))
    .limit(1);
  if (l) await db.insert(chatEvents).values({ sessionId: sid!, listingId: l.id, type });
  return new Response(null, { status: 204 });
}
