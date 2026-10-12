import { createUIMessageStreamResponse } from 'ai';
import { cookies, headers } from 'next/headers';
import { chatConfig } from '@/lib/kamanga-ai/config';
import { getOrCreateSession } from '@/lib/kamanga-ai/chat-store';
import { handleChatTurn } from '@/lib/kamanga-ai/handler';
import { cookieOptions, ipHashOf, sameOrigin, SESSION_COOKIE } from '@/lib/kamanga-ai/request';

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: 'Asal permintaan tidak diizinkan' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return Response.json({ error: 'Pesan kosong' }, { status: 400 });
  if (text.length > chatConfig().maxMessageChars * 4)
    return Response.json({ error: 'Pesan terlalu panjang' }, { status: 413 });

  const store = await cookies();
  const ipHash = ipHashOf(await headers());
  const sessionId = await getOrCreateSession(store.get(SESSION_COOKIE)?.value, ipHash);
  store.set(SESSION_COOKIE, sessionId, cookieOptions());

  const stream = await handleChatTurn({ sessionId, ipHash, text });
  return createUIMessageStreamResponse({ stream });
}
