// Menjalankan keputusan router: mesin (findProviders), pencarian lama, atau tanya jawab penyedia.
// Dipakai jalur kode (handler) dan tool model AI, supaya keduanya memakai aturan dan kartu yang sama.
import type { LanguageModel } from 'ai';
import { logProviderSearch } from './demand';
import { searchProviders } from './provider-search';
import {
  answerProviderQuestion,
  focusReply,
  forwardQuestion,
  loadProviderData
} from './provider-qa';
import * as replies from './replies';
import type { Decision, TurnCtx } from './router';
import { runListingSearch } from './search-tool';
import type { ChatState, Reply } from './types';

export type ExecCtx = TurnCtx & {
  sessionId: string | null;
  /** Warga yang sedang masuk (untuk listing_qa.asked_by). Tidak pernah dikirim ke model AI. */
  userId?: string | null;
  source: 'rules' | 'llm';
  /** Boleh memakai model AI untuk menjawab pertanyaan penyedia yang tidak terjawab kode. */
  allowModel?: boolean;
  modelOverride?: { model: LanguageModel; id: string };
};

export type Executed = { reply: Reply; state: ChatState; route: 'template' | 'rules' | 'llm' };

export async function execute(
  d: Exclude<Decision, { kind: 'llm' }>,
  s: ChatState,
  c: ExecCtx
): Promise<Executed> {
  switch (d.kind) {
    case 'reply':
      return { reply: d.reply, state: s, route: 'template' };
    case 'providers': {
      const r = await searchProviders(s, {
        origin: d.origin,
        now: c.now,
        scheduleKind: d.scheduleKind,
        attributeLabels: d.attributeLabels
      });
      if (c.sessionId) void logProviderSearch(c.sessionId, c.source, s, r).catch(() => {});
      return { reply: r.reply, state: { ...s, shown: r.shown }, route: 'rules' };
    }
    case 'search': {
      const o = await runListingSearch({
        ...d.args,
        meta: c.sessionId ? { sessionId: c.sessionId, source: c.source } : undefined
      });
      const shown =
        o.status === 'ok'
          ? o.items.filter((i) => i.slug).map((i) => ({ id: i.id, slug: i.slug!, name: i.name }))
          : [];
      return {
        reply: replies.fromOutcome(o, c.seed, d.ctx),
        state: { ...s, shown },
        route: 'rules'
      };
    }
    case 'focus': {
      const p = await loadProviderData(d.listingId);
      if (!p)
        return { reply: replies.unclear([]), state: { ...s, focus: null }, route: 'template' };
      return { reply: focusReply(p), state: s, route: 'rules' };
    }
    case 'ask_provider': {
      const p = await loadProviderData(d.listingId);
      if (!p)
        return { reply: replies.unclear([]), state: { ...s, focus: null }, route: 'template' };
      const out = await answerProviderQuestion(p, d.question, {
        sessionId: c.sessionId,
        useModel: !!c.allowModel,
        handle: c.modelOverride ? { ...c.modelOverride, tier: 'cheap' } : undefined
      });
      return {
        reply: out.reply,
        state: out.forwardOffer
          ? { ...s, pending: { kind: 'forward', listingId: p.id, question: d.question } }
          : s,
        route: out.route
      };
    }
    case 'forward':
      return {
        reply: await forwardQuestion(d.listingId, d.question, {
          sessionId: c.sessionId,
          userId: c.userId
        }),
        state: s,
        route: 'rules'
      };
  }
}
