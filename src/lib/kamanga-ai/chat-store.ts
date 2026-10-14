// Penyimpanan percakapan: sesi anonim (ID acak di cookie) dan pesan.
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions } from '@/db/schema';
import type { ChatState, KamangaMessage, ListingsData, ProvidersData } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getOrCreateSession(
  sid: string | null | undefined,
  ipHash: string | null
): Promise<string> {
  if (sid && UUID.test(sid)) {
    const [s] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.id, sid))
      .limit(1);
    if (s) return s.id;
  }
  const [row] = await db.insert(chatSessions).values({ ipHash }).returning({ id: chatSessions.id });
  return row.id;
}

export type StoredMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  parts: unknown[];
  route: string | null;
};

export async function loadHistory(sessionId: string, limit: number): Promise<StoredMessage[]> {
  const rows = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      parts: chatMessages.parts,
      route: chatMessages.route
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.id))
    .limit(limit);
  return rows.reverse().map((r) => ({ ...r, role: r.role as 'user' | 'assistant' }));
}

export async function saveUserMessage(sessionId: string, text: string) {
  await db
    .insert(chatMessages)
    .values({ sessionId, role: 'user', content: text, parts: [{ type: 'text', text }] });
  await db
    .update(chatSessions)
    .set({ messageCount: sql`${chatSessions.messageCount} + 1`, lastSeenAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

type Part = { type: string; text?: string; data?: unknown };

/** Simpan balasan. Hanya teks, kartu, dan tombol yang disimpan (bukan hasil mentah tool). */
export async function saveAssistantMessage(
  sessionId: string,
  parts: Part[],
  route: 'template' | 'rules' | 'llm' | 'limit' | 'error'
) {
  const keep = parts.filter(
    (p) =>
      p.type === 'text' ||
      p.type === 'data-listings' ||
      p.type === 'data-providers' ||
      p.type === 'data-chips'
  );
  const text = keep
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('\n')
    .trim();
  const providers = keep.find((p) => p.type === 'data-providers')?.data as
    | ProvidersData
    | undefined;
  const shown = [
    ...((keep.find((p) => p.type === 'data-listings')?.data as ListingsData | undefined)?.items ??
      []),
    ...(providers?.items ?? [])
  ].map((i) => i.name);
  // Teks yang dilihat model pada giliran berikutnya: balasan + nama usaha yang tadi ditampilkan.
  const content = shown?.length ? `${text}\n[Ditampilkan: ${shown.join('; ')}]` : text;
  await db
    .insert(chatMessages)
    .values({ sessionId, role: 'assistant', content: content || '(kosong)', parts: keep, route });
}

/** Niat sesi (PRD 8.2). Tidak memuat koordinat, nomor, atau alamat warga. */
export async function loadState(sessionId: string): Promise<ChatState> {
  const [s] = await db
    .select({ state: chatSessions.state })
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId))
    .limit(1);
  return (s?.state ?? {}) as ChatState;
}

export async function saveState(sessionId: string, state: ChatState) {
  await db
    .update(chatSessions)
    .set({ state: state as Record<string, unknown> })
    .where(eq(chatSessions.id, sessionId));
}

export async function loadUiMessages(sessionId: string, limit = 40): Promise<KamangaMessage[]> {
  const rows = await db
    .select({ id: chatMessages.id, role: chatMessages.role, parts: chatMessages.parts })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.id))
    .limit(limit);
  return rows.reverse().map((r) => ({
    id: String(r.id),
    role: r.role as 'user' | 'assistant',
    parts: r.parts as KamangaMessage['parts']
  }));
}

export async function sessionExists(sid: string | null | undefined) {
  if (!sid || !UUID.test(sid)) return false;
  const [s] = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sid)))
    .limit(1);
  return !!s;
}
