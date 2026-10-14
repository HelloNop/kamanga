// Satu giliran percakapan: batas pemakaian → router (template → kode → AI) → mesin → simpan → alirkan ke layar.
// Niat terstruktur sesi dibaca dari dan disimpan ke chat_sessions.state.
import { createUIMessageStream, type LanguageModel } from 'ai';
import { findKamusTerms } from '@/lib/directory/understand';
import type { Point } from '@/lib/engines/contracts';
import { chatConfig } from './config';
import { runAgent } from './agent';
import {
  loadHistory,
  loadState,
  saveAssistantMessage,
  saveState,
  saveUserMessage
} from './chat-store';
import { redact } from './extract';
import { acquireLlmSlot } from './queue';
import { llmAvailability, getModel, recordLlmCall, type ModelHandle } from './gateway';
import { userMessagesToday, userMessagesTodayByIp } from './limits';
import * as replies from './replies';
import { decide, doorChips } from './router';
import { execute } from './turn';
import type { ChatAction, ChatState, KamangaMessage, Reply } from './types';

export type TurnInput = {
  sessionId: string;
  ipHash: string | null;
  text: string;
  /** Aksi tombol (kategori, wilayah, pelonggaran, tanya penyedia, teruskan pertanyaan, lokasi saya). */
  action?: ChatAction | null;
  /** Titik perangkat bersama aksi lokasi. Hanya dipakai untuk pencarian ini, tidak disimpan. */
  point?: Point | null;
  /** Warga yang sedang masuk (hanya untuk listing_qa.asked_by). */
  userId?: string | null;
  /** Untuk pengujian: waktu "sekarang". */
  now?: Date;
  /** Untuk pengujian: pakai model ini (mis. model tiruan) alih-alih vendor sungguhan. */
  modelOverride?: { model: LanguageModel; id: string };
};

export const partsOf = (r: Reply) => [
  { type: 'text', text: r.text },
  ...(r.listings ? [{ type: 'data-listings', data: r.listings }] : []),
  ...(r.providers ? [{ type: 'data-providers', data: r.providers }] : []),
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
      if (r.providers) writer.write({ type: 'data-providers', data: r.providers });
      if (r.chips?.length) writer.write({ type: 'data-chips', data: { options: r.chips } });
      writer.write({ type: 'finish' });
    }
  });
}

async function storeAndStream(
  sessionId: string,
  r: Reply,
  route: 'template' | 'rules' | 'llm' | 'limit' | 'error'
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

  const [history, state] = await Promise.all([
    loadHistory(sessionId, cfg.historyMessages),
    loadState(sessionId)
  ]);
  await saveUserMessage(sessionId, text);
  const ctx = {
    now: input.now ?? new Date(),
    seed: history.length,
    point: input.point ?? null,
    action: input.action ?? null
  };
  const aiReady = input.modelOverride ? true : (await llmAvailability('cheap')).ok;

  // 2) template dan jalur kode: niat → mesin
  const routed = await decide(text, state, ctx);
  if (routed.decision.kind !== 'llm') {
    const out = await execute(routed.decision, routed.state, {
      ...ctx,
      sessionId,
      userId: input.userId,
      source: 'rules',
      allowModel: aiReady,
      modelOverride: input.modelOverride
    });
    await saveState(sessionId, out.state);
    return storeAndStream(sessionId, out.reply, out.route);
  }
  await saveState(sessionId, routed.state);

  // 3) model AI (hanya bila tersedia dan belum melewati rem harian)
  let handle: ModelHandle | null = null;
  if (input.modelOverride) handle = { ...input.modelOverride, tier: 'cheap' };
  else {
    const avail = await llmAvailability('cheap');
    const chips = await doorChips();
    if (avail.ok) handle = await getModel('cheap');
    else
      return storeAndStream(
        sessionId,
        avail.reason === 'budget' ? replies.aiResting(chips) : replies.unclear(chips),
        avail.reason === 'budget' ? 'limit' : 'template'
      );
  }

  // Arti kata Minang/sehari-hari dari kamus (yang sudah dicek) ikut dikirim sebagai konteks.
  const kamus = await findKamusTerms(text);
  // Tool model AI memakai router dan mesin yang sama; niat yang diubahnya disimpan di akhir.
  const stateRef: { current: ChatState } = { current: routed.state };

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
        // Nomor telepon dan email yang terlanjur diketik warga tidak ikut dikirim ke model.
        history: history.map((m) => ({ role: m.role, content: redact(m.content) })),
        text: redact(text),
        kamus,
        tool: { ...ctx, sessionId, userId: input.userId, stateRef },
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
      await saveState(sessionId, stateRef.current);
      await saveAssistantMessage(
        sessionId,
        hasText ? parts : [...parts, { type: 'text', text: replies.busy().text }],
        crowded ? 'limit' : failed || !hasText ? 'error' : 'llm'
      );
    }
  });
}
