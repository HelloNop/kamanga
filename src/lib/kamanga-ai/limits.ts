// Pembatas pemakaian: pesan per sesi/IP per hari, dan batas pemakaian model AI per hari. Hari dihitung WIB.
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions, llmCalls } from '@/db/schema';

const dayStart = sql`(date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')`;

export async function userMessagesToday(sessionId: string): Promise<number> {
  return db.$count(
    chatMessages,
    sql`${chatMessages.sessionId} = ${sessionId} and ${chatMessages.role} = 'user' and ${chatMessages.createdAt} >= ${dayStart}`
  );
}

export async function userMessagesTodayByIp(ipHash: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.sessionId))
    .where(
      sql`${chatSessions.ipHash} = ${ipHash} and ${chatMessages.role} = 'user' and ${chatMessages.createdAt} >= ${dayStart}`
    );
  return r?.n ?? 0;
}

export async function llmUsageToday(): Promise<{ tokens: number; costUsd: number }> {
  const [r] = await db
    .select({
      tokens: sql<number>`coalesce(sum(${llmCalls.inputTokens} + ${llmCalls.outputTokens}), 0)::float8`,
      costUsd: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)::float8`
    })
    .from(llmCalls)
    .where(sql`${llmCalls.createdAt} >= ${dayStart}`);
  return { tokens: r?.tokens ?? 0, costUsd: r?.costUsd ?? 0 };
}
