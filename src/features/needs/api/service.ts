'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { NeedFormValues } from '../schemas/need';
import type { MutationResult, NeedDetail, NeedFilters, NeedOptions, NeedsResponse } from './types';

export async function getNeeds(filters: NeedFilters): Promise<NeedsResponse> {
  await requireAdmin();
  return repo.listNeeds(filters);
}

export async function getNeedById(id: number): Promise<NeedDetail | null> {
  await requireAdmin();
  return repo.getNeedDetail(id);
}

export async function getNeedOptions(): Promise<NeedOptions> {
  await requireAdmin();
  return repo.getNeedOptions();
}

export async function createNeed(values: NeedFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.createNeed(values);
}

export async function updateNeed(id: number, values: NeedFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.updateNeed(id, values);
}

export async function setNeedActive(id: number, isActive: boolean): Promise<MutationResult> {
  await requireAdmin();
  return repo.setNeedActive(id, isActive);
}

export async function deleteNeed(id: number): Promise<MutationResult> {
  await requireAdmin();
  return repo.deleteNeed(id);
}
