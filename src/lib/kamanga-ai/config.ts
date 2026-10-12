// Pengaturan chatbot dari environment. Dibaca saat dipakai (bukan saat modul dimuat) agar mudah diuji.
const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};
const num = (v: string | undefined) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

export const chatConfig = () => ({
  messagesPerSessionPerDay: int(process.env.CHAT_MAX_MESSAGES_PER_SESSION_DAY, 30),
  messagesPerIpPerDay: int(process.env.CHAT_MAX_MESSAGES_PER_IP_DAY, 150),
  maxMessageChars: 500,
  historyMessages: 8
});

// `router`: gerbang lokal yang kompatibel dengan OpenAI (mis. 9router). Alamat di LLM_BASE_URL.
export type Provider = 'none' | 'anthropic' | 'openai' | 'google' | 'router';
export type Tier = 'cheap' | 'strong';

const KEY_ENV: Record<Exclude<Provider, 'none'>, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  router: 'LLM_API_KEY'
};
// Hanya Anthropic yang punya bawaan (id model resmi yang saya ketahui). Vendor lain wajib diisi eksplisit.
const DEFAULT_MODELS: Partial<Record<Provider, Record<Tier, string>>> = {
  anthropic: { cheap: 'claude-haiku-5-5', strong: 'claude-sonnet-5-5' }
};

export function llmConfig() {
  const raw = (process.env.LLM_PROVIDER ?? 'none').toLowerCase();
  const provider: Provider =
    raw === 'anthropic' || raw === 'openai' || raw === 'google' || raw === 'router' ? raw : 'none';
  const model = (tier: Tier) =>
    (tier === 'cheap' ? process.env.LLM_MODEL_CHEAP : process.env.LLM_MODEL_STRONG) ||
    DEFAULT_MODELS[provider]?.[tier] ||
    null;
  return {
    provider,
    baseUrl: process.env.LLM_BASE_URL || 'http://localhost:20128/v1',
    keyEnv: provider === 'none' ? null : KEY_ENV[provider],
    hasKey: provider !== 'none' && !!process.env[KEY_ENV[provider]],
    model,
    dailyTokenLimit: int(process.env.LLM_DAILY_TOKEN_LIMIT, 300_000),
    dailyCostLimitUsd: num(process.env.LLM_DAILY_COST_LIMIT_USD),
    // harga per 1 juta token (USD) dari halaman harga vendor; kosong = biaya tidak dihitung
    price: {
      input: num(process.env.LLM_PRICE_INPUT_PER_MTOK),
      cached: num(process.env.LLM_PRICE_CACHED_PER_MTOK),
      output: num(process.env.LLM_PRICE_OUTPUT_PER_MTOK)
    }
  };
}
