// Gerbang ke vendor model AI. Semua panggilan model lewat sini, sehingga vendor bisa diganti lewat pengaturan,
// pemakaian tercatat, dan "rem darurat" harian bekerja di satu tempat.
import type { LanguageModel } from 'ai';
import { db } from '@/db';
import { llmCalls } from '@/db/schema';
import { llmConfig, type Tier } from './config';
import { llmUsageToday } from './limits';

export type ModelHandle = { model: LanguageModel; id: string; tier: Tier };
export type Availability =
  | { ok: true }
  | { ok: false; reason: 'no_provider' | 'no_key' | 'no_model' | 'budget' };

/** Apakah model AI boleh dipanggil sekarang? Jalur kode tidak terpengaruh. */
export async function llmAvailability(tier: Tier = 'cheap'): Promise<Availability> {
  const c = llmConfig();
  if (c.provider === 'none') return { ok: false, reason: 'no_provider' };
  if (!c.hasKey) return { ok: false, reason: 'no_key' };
  if (!c.model(tier)) return { ok: false, reason: 'no_model' };
  const used = await llmUsageToday();
  if (used.tokens >= c.dailyTokenLimit) return { ok: false, reason: 'budget' };
  if (c.dailyCostLimitUsd !== null && used.costUsd >= c.dailyCostLimitUsd)
    return { ok: false, reason: 'budget' };
  return { ok: true };
}

export async function getModel(tier: Tier = 'cheap'): Promise<ModelHandle> {
  const c = llmConfig();
  const id = c.model(tier);
  if (c.provider === 'none' || !id) throw new Error('Model AI belum dikonfigurasi');
  // Paket vendor dan `ai` membawa salinan @ai-sdk/provider (versi 4.x) yang berbeda sehingga pemeriksaan tipe bentrok,
  // padahal spesifikasinya sama (V4). Konversi ini hanya ada di sini. Hapus bila versinya sudah seragam.
  const load = async (): Promise<unknown> => {
    switch (c.provider) {
      case 'anthropic':
        return (await import('@ai-sdk/anthropic')).anthropic(id);
      case 'openai':
        return (await import('@ai-sdk/openai')).openai(id);
      case 'google':
        return (await import('@ai-sdk/google')).google(id);
      case 'router': {
        // Gerbang kompatibel OpenAI hanya menjamin /chat/completions (bukan Responses API).
        const { createOpenAI } = await import('@ai-sdk/openai');
        return createOpenAI({ baseURL: c.baseUrl, apiKey: process.env.LLM_API_KEY }).chat(id);
      }
    }
  };
  return { model: (await load()) as LanguageModel, id, tier };
}

export type Usage = { inputTokens?: number; cachedTokens?: number; outputTokens?: number };

/** Perkiraan biaya (USD) dari harga yang Anda isi di pengaturan; null bila harga belum diisi. */
export function costOf(u: Usage): number | null {
  const p = llmConfig().price;
  if (p.input === null || p.output === null) return null;
  const cached = Math.min(u.cachedTokens ?? 0, u.inputTokens ?? 0);
  const fresh = (u.inputTokens ?? 0) - cached;
  return (
    (fresh * p.input + cached * (p.cached ?? p.input) + (u.outputTokens ?? 0) * p.output) /
    1_000_000
  );
}

export async function recordLlmCall(c: {
  sessionId: string | null;
  model: string;
  tier: Tier;
  usage: Usage;
  latencyMs: number;
  error?: string;
}) {
  const cost = costOf(c.usage);
  await db.insert(llmCalls).values({
    sessionId: c.sessionId,
    model: c.model,
    tier: c.tier,
    inputTokens: c.usage.inputTokens ?? 0,
    cachedTokens: c.usage.cachedTokens ?? 0,
    outputTokens: c.usage.outputTokens ?? 0,
    costUsd: cost === null ? null : cost.toFixed(6),
    latencyMs: Math.round(c.latencyMs),
    error: c.error ?? null
  });
}
