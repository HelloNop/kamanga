'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { Overview } from './types';

export async function getOverview(): Promise<Overview> {
  await requireAdmin();
  return repo.getOverview();
}
