import { createUIMessageStreamResponse } from 'ai';
import { cookies, headers } from 'next/headers';
import * as z from 'zod';
import { auth } from '@/lib/auth';
import { chatConfig } from '@/lib/kamanga-ai/config';
import { getOrCreateSession } from '@/lib/kamanga-ai/chat-store';
import { handleChatTurn } from '@/lib/kamanga-ai/handler';
import { cookieOptions, ipHashOf, sameOrigin, SESSION_COOKIE } from '@/lib/kamanga-ai/request';

export const maxDuration = 60;

// Aksi tombol dan titik perangkat dikirim di body (bukan URL, agar tidak tercatat di log server).
const Body = z.object({
  text: z.string(),
  action: z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('category'), id: z.number().int().positive() }),
      z.object({ kind: z.literal('region'), id: z.number().int().positive() }),
      z.object({
        kind: z.literal('relax'),
        key: z.enum(['radius', 'time', 'budget', 'attributes'])
      }),
      z.object({ kind: z.literal('focus'), slug: z.string().max(200) }),
      z.object({ kind: z.literal('forward'), yes: z.boolean() }),
      z.object({ kind: z.literal('location') })
    ])
    .nullish(),
  point: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullish()
});

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: 'Asal permintaan tidak diizinkan' }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const text = parsed.success ? parsed.data.text.trim() : '';
  if (!text) return Response.json({ error: 'Pesan kosong' }, { status: 400 });
  if (text.length > chatConfig().maxMessageChars * 4)
    return Response.json({ error: 'Pesan terlalu panjang' }, { status: 413 });

  const store = await cookies();
  const h = await headers();
  const ipHash = ipHashOf(h);
  const sessionId = await getOrCreateSession(store.get(SESSION_COOKIE)?.value, ipHash);
  store.set(SESSION_COOKIE, sessionId, cookieOptions());
  // Hanya untuk mencatat penanya di listing_qa; identitas warga tidak pernah dikirim ke model AI.
  const session = await auth.api.getSession({ headers: h }).catch(() => null);
  const userId = session?.user.role === 'citizen' ? session.user.id : null;

  const stream = await handleChatTurn({
    sessionId,
    ipHash,
    text,
    action: parsed.data!.action ?? null,
    point: parsed.data!.action?.kind === 'location' ? (parsed.data!.point ?? null) : null,
    userId
  });
  return createUIMessageStreamResponse({ stream });
}
