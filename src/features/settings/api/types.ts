import type { SettingsFormValues } from '../schemas/settings';

export type { SettingsFormValues };

/** Nilai yang hanya ditampilkan (diatur lewat env server, bukan dari dashboard). */
export type EnvStatus = {
  /** api: keempat env WhatsApp terisi; fallback: mode cadangan wa.me. */
  waMode: 'api' | 'fallback';
  /** Nama env dan apakah terisi. Nilainya tidak pernah dikirim ke klien. */
  waEnv: { name: string; set: boolean }[];
  chat: { perSessionPerDay: number; perIpPerDay: number; maxChars: number };
  llm: {
    provider: string;
    hasKey: boolean;
    modelCheap: string | null;
    modelStrong: string | null;
    dailyTokenLimit: number;
    dailyCostLimitUsd: number | null;
  };
};

export type SettingsView = { values: SettingsFormValues; env: EnvStatus };

export type SaveResult = { ok: true } | { ok: false; message: string };
