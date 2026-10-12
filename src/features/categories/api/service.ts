'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { CategoryFormValues } from '../schemas/category';
import type {
  CategoriesResponse,
  CategoryDetail,
  CategoryFilters,
  CategoryGroupOption,
  GroupResult,
  MutationResult
} from './types';

export async function getCategories(filters: CategoryFilters): Promise<CategoriesResponse> {
  await requireAdmin();
  return repo.listCategories(filters);
}

export async function getCategoryGroups(): Promise<CategoryGroupOption[]> {
  await requireAdmin();
  return repo.listGroups();
}

export async function getCategoryById(id: number): Promise<CategoryDetail | null> {
  await requireAdmin();
  return repo.getCategoryDetail(id);
}

export async function createCategory(values: CategoryFormValues): Promise<MutationResult> {
  await requireAdmin();
  return repo.createCategory(values);
}

export async function updateCategory(
  id: number,
  values: CategoryFormValues
): Promise<MutationResult> {
  await requireAdmin();
  return repo.updateCategory(id, values);
}

export async function setCategoryActive(id: number, isActive: boolean): Promise<MutationResult> {
  await requireAdmin();
  return repo.setCategoryActive(id, isActive);
}

export async function deleteCategory(id: number): Promise<MutationResult> {
  await requireAdmin();
  return repo.deleteCategory(id);
}

export async function createCategoryGroup(name: string): Promise<GroupResult> {
  await requireAdmin();
  return repo.createGroup(name);
}

export async function renameCategoryGroup(id: number, name: string): Promise<GroupResult> {
  await requireAdmin();
  return repo.renameGroup(id, name);
}

export async function deleteCategoryGroup(id: number): Promise<MutationResult> {
  await requireAdmin();
  return repo.deleteGroup(id);
}
