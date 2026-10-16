// Pengaturan admin (tabel app_settings). TANPA pemeriksaan login: hanya diimpor oleh service.ts (dan uji).
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import { chatConfig, llmConfig } from '@/lib/kamanga-ai/config';
import { getSetting } from '@/lib/settings';
import { EDITABLE_TEMPLATES } from '../lib/templates';
import { settingsFormSchema, type SettingsFormValues } from '../schemas/settings';
import type { EnvStatus, SaveResult } from './types';

const WA_ENV = ['WA_PHONE_NUMBER_ID', 'WA_ACCESS_TOKEN', 'WA_APP_SECRET', 'WA_VERIFY_TOKEN'];

export async function getSettingsValues(): Promise<SettingsFormValues> {
  const [response, reminder, templates] = await Promise.all([
    getSetting('booking.default_response_minutes'),
    getSetting('booking.reminder_minutes_before'),
    getSetting('wa.templates')
  ]);
  return {
    defaultResponseMinutes: response,
    reminderMinutesBefore: reminder,
    // Semua template tampil di formulir; yang belum diubah berisi teks kosong (= bawaan).
    waTemplates: Object.fromEntries(EDITABLE_TEMPLATES.map((t) => [t, templates[t] ?? '']))
  };
}

/** Hanya ADA/TIDAKNYA env yang dibaca; nilainya tidak pernah keluar dari server. */
export function getEnvStatus(): EnvStatus {
  const waEnv = WA_ENV.map((name) => ({ name, set: !!process.env[name] }));
  const chat = chatConfig();
  const llm = llmConfig();
  return {
    waMode: waEnv.every((e) => e.set) ? 'api' : 'fallback',
    waEnv,
    chat: {
      perSessionPerDay: chat.messagesPerSessionPerDay,
      perIpPerDay: chat.messagesPerIpPerDay,
      maxChars: chat.maxMessageChars
    },
    llm: {
      provider: llm.provider,
      hasKey: llm.hasKey,
      modelCheap: llm.model('cheap'),
      modelStrong: llm.model('strong'),
      dailyTokenLimit: llm.dailyTokenLimit,
      dailyCostLimitUsd: llm.dailyCostLimitUsd
    }
  };
}

export async function saveSettings(userId: string, input: SettingsFormValues): Promise<SaveResult> {
  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Data tidak valid' };
  const v = parsed.data;
  // Teks kosong tidak disimpan: mesin Notifikasi lalu memakai teks bawaan.
  const templates = Object.fromEntries(
    Object.entries(v.waTemplates)
      .map(([k, t]) => [k, t.trim()] as const)
      .filter(([, t]) => t)
  );
  const now = new Date();
  await db
    .insert(appSettings)
    .values(
      [
        { key: 'booking.default_response_minutes', value: v.defaultResponseMinutes },
        { key: 'booking.reminder_minutes_before', value: v.reminderMinutesBefore },
        { key: 'wa.templates', value: templates }
      ].map((r) => ({ ...r, updatedBy: userId, updatedAt: now }))
    )
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: sql`excluded.value`, updatedBy: userId, updatedAt: now }
    });
  return { ok: true };
}
