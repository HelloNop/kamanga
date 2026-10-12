// Satu giliran percakapan: batas pemakaian -> router -> (jalur kode | model AI) -> simpan -> alirkan ke layar.
import { createUIMessageStream, type LanguageModel } from 'ai';
import { findKamusTerms } from '@/lib/directory/understand';
import { chatConfig } from './config';
import { runAgent } from './agent';
import { loadHistory, saveAssistantMessage, saveUserMessage } from './chat-store';
import { acquireLlmSlot } from './queue';
import { llmAvailability, getModel, recordLlmCall, type ModelHandle } from './gateway';
import { userMessagesToday, userMessagesTodayByIp } from './limits';
import * as replies from './replies';
import { decide, quickReply } from './router';
import { runListingSearch } from './search-tool';
import type { KamangaMessage, Reply } from './types';

export type TurnInput = {
  sessionId: string;
  ipHash: string | null;
  text: string;
  /** Untuk pengujian: pakai model ini (mis. model tiruan) alih-alih vendor sungguhan. */
  modelOverride?: { model: LanguageModel; id: string };
};

const partsOf = (r: Reply) => [
  { type: 'text', text: r.text },
  ...(r.listings ? [{ type: 'data-listings', data: r.listings }] : []),
  ...(r.chips?.length ? [{ type: 'data-chips', data: { options: r.chips } }] : [])
];

/** Alirkan balasan yang sudah jadi (dari kode) sebagai pesan asisten. */
function replyStream(r: Reply) {
  return createUIMessageStream<KamangaMessage>({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: 't' });
      writer.write({ type: 'text-delta', id: 't', delta: r.text });
      writer.write({ type: 'text-end', id: 't' });
      if (r.listings) writer.write({ type: 'data-listings', data: r.listings });
      if (r.chips?.length) writer.write({ type: 'data-chips', data: { options: r.chips } });
      writer.write({ type: 'finish' });
    }
  });
}

async function storeAndStream(
  sessionId: string,
  r: Reply,
  route: 'template' | 'rules' | 'limit' | 'error'
) {
  await saveAssistantMessage(sessionId, partsOf(r), route);
  return replyStream(r);
}

export async function handleChatTurn(input: TurnInput) {
  const cfg = chatConfig();
  const text = input.text.trim().slice(0, cfg.maxMessageChars);
  const { sessionId } = input;

  // 1) batas pemakaian per sesi dan per IP
  const [perSession, perIp] = await Promise.all([
    userMessagesToday(sessionId),
    input.ipHash ? userMessagesTodayByIp(input.ipHash) : Promise.resolve(0)
  ]);
  if (perSession >= cfg.messagesPerSessionPerDay || perIp >= cfg.messagesPerIpPerDay) {
    await saveUserMessage(sessionId, text);
    return storeAndStream(sessionId, replies.limitReached(), 'limit');
  }

  const history = await loadHistory(sessionId, cfg.historyMessages);
  await saveUserMessage(sessionId, text);
  const seed = history.length;
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const awaitingLocation = /di mana lokasinya|belum saya kenali sebagai lokasi/i.test(
    lastAssistant
  );
  // Mode AI-first (bawaan): semua pesan, selain sapaan/terima kasih/menu yang murni, dijawab model AI karena
  // hanya model yang menjaga ingatan percakapan. Jalur kode menjadi cadangan bila model AI tidak tersedia.
  // CHAT_MODE=hybrid mengembalikan perilaku lama: kode menjawab dulu yang bisa dipahami.
  const aiFirst = process.env.CHAT_MODE !== 'hybrid';
  if (aiFirst) {
    const quick = await quickReply(text, seed);
    if (quick) return storeAndStream(sessionId, quick, 'template');
  }
  const aiReady = input.modelOverride ? true : (await llmAvailability('cheap')).ok;
  const decision =
    aiFirst && aiReady
      ? ({ kind: 'llm' } as const)
      : await decide(
          text,
          history.filter((m) => m.role === 'user').map((m) => m.content),
          seed,
          { awaitingLocation }
        );

  // 2) jalur kode
  if (decision.kind === 'reply') return storeAndStream(sessionId, decision.reply, 'template');
  if (decision.kind === 'search') {
    const outcome = await runListingSearch({
      ...decision.args,
      meta: { sessionId, source: 'rules' }
    });
    return storeAndStream(sessionId, replies.fromOutcome(outcome, seed, decision.ctx), 'rules');
  }

  // 3) jalur model AI (hanya bila tersedia dan belum melewati rem harian)
  let handle: ModelHandle | null = null;
  if (input.modelOverride) handle = { ...input.modelOverride, tier: 'cheap' };
  else {
    const avail = await llmAvailability('cheap');
    if (avail.ok) handle = await getModel('cheap');
    else
      return storeAndStream(
        sessionId,
        avail.reason === 'budget' ? replies.aiResting([]) : replies.unclear([]),
        avail.reason === 'budget' ? 'limit' : 'template'
      );
  }

  // Arti kata Minang/sehari-hari dari kamus (yang sudah dicek) ikut dikirim sebagai konteks.
  const kamus = await findKamusTerms(text);

  let failed = false;
  let crowded = false;
  return createUIMessageStream<KamangaMessage>({
    originalMessages: [],
    execute: async ({ writer }) => {
      // Antre dulu: panggilan model AI dibatasi agar vendor dan biaya aman saat ramai.
      const slot = await acquireLlmSlot();
      if (!slot.ok) {
        crowded = true;
        const text = replies.crowded().text;
        writer.write({ type: 'text-start', id: 't' });
        writer.write({ type: 'text-delta', id: 't', delta: text });
        writer.write({ type: 'text-end', id: 't' });
        return;
      }
      runAgent({
        writer,
        handle: handle!,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        text,
        kamus,
        sessionId,
        onDone: async (info) => {
          slot.release();
          await recordLlmCall({
            sessionId,
            model: handle!.id,
            tier: handle!.tier,
            usage: info.usage,
            latencyMs: info.latencyMs,
            error: info.error
          });
        },
        onError: () => {
          failed = true;
        }
      });
    },
    onError: () => replies.busy().text,
    onEnd: async ({ responseMessage }) => {
      const parts = responseMessage.parts as { type: string; text?: string; data?: unknown }[];
      const hasText = parts.some((p) => p.type === 'text' && p.text?.trim());
      await saveAssistantMessage(
        sessionId,
        hasText ? parts : [...parts, { type: 'text', text: replies.busy().text }],
        crowded ? 'limit' : failed || !hasText ? 'error' : 'llm'
      );
    }
  });
}
