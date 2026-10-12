'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { GlossaryFormValues } from '../schemas/glossary';
import type { GlossaryDetail, GlossaryFilters, GlossaryResponse, MutationResult } from './types';

export async function getGlossary(filters: GlossaryFilters): Promise<GlossaryResponse> {
  await requireAdmin();
  return repo.listGlossary(filters);
}

export async function getGlossaryById(id: number): Promise<GlossaryDetail | null> {
  await requireAdmin();
  return repo.getGlossaryDetail(id);
}

export async function createGlossaryTerm(values: GlossaryFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.createGlossaryTerm(values);
}

export async function updateGlossaryTerm(
  id: number,
  values: GlossaryFormValues
): Promise<MutationResult> {
  await requireAdmin();
  return repo.updateGlossaryTerm(id, values);
}

export async function setGlossaryChecked(id: number, isChecked: boolean): Promise<MutationResult> {
  await requireAdmin();
  return repo.setGlossaryChecked(id, isChecked);
}

export async function deleteGlossaryTerm(id: number): Promise<MutationResult> {
  await requireAdmin();
  return repo.deleteGlossaryTerm(id);
}
