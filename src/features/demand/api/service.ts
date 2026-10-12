'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { DemandPeriod, DemandReport } from './types';

export async function getDemandReport(days: DemandPeriod): Promise<DemandReport> {
  await requireAdmin();
  const safe: DemandPeriod = days === 7 || days === 90 ? days : 30;
  return repo.getDemandReport(safe);
}
