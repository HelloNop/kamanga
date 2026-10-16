'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { SaveResult, SettingsFormValues, SettingsView } from './types';

export async function getSettings(): Promise<SettingsView> {
  await requireAdmin();
  return { values: await repo.getSettingsValues(), env: repo.getEnvStatus() };
}

export async function saveSettings(values: SettingsFormValues): Promise<SaveResult> {
  const { user } = await requireAdmin();
  return repo.saveSettings(user.id, values);
}
