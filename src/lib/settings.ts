// Pengaturan yang diubah admin tanpa koding (tabel app_settings). Nilai bawaan ada di sini.
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { appSettings } from '@/db/schema';

export const SETTING_DEFAULTS = {
  /** Batas waktu penyedia menjawab pesanan bila kategori tidak mengaturnya (PRD 8.5 [USULAN]). */
  'booking.default_response_minutes': 30,
  /** Pengingat ke warga sebelum jadwal (PRD 8.4 [USULAN]). */
  'booking.reminder_minutes_before': 120,
  /** Teks pengganti template WA untuk mode cadangan, per nama template. Kosong = teks bawaan. */
  'wa.templates': {} as Record<string, string>
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(
  key: K
): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return (row?.value as (typeof SETTING_DEFAULTS)[K] | undefined) ?? SETTING_DEFAULTS[key];
}
