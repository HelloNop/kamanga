import { mutationOptions } from '@tanstack/react-query';
import { listingKeys } from '@/features/listings/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { categoryKeys } from './queries';
import {
  createCategory,
  createCategoryGroup,
  deleteCategory,
  deleteCategoryGroup,
  renameCategoryGroup,
  setCategoryActive,
  updateCategory
} from './service';
import type { CategoryFormValues, GroupResult, MutationResult } from './types';

const unwrap = <T extends MutationResult | GroupResult>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error(r.message);
  return r as Extract<T, { ok: true }>;
};
// Pilihan kategori di formulir listing ikut berubah, jadi segarkan juga.
const refresh = () =>
  Promise.all([
    getQueryClient().invalidateQueries({ queryKey: categoryKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: listingKeys.options() })
  ]);

export const createCategoryMutation = mutationOptions({
  mutationFn: async (values: CategoryFormValues) => unwrap(await createCategory(values)),
  onSuccess: refresh
});
export const updateCategoryMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: CategoryFormValues }) =>
    unwrap(await updateCategory(id, values)),
  onSuccess: refresh
});
export const setCategoryActiveMutation = mutationOptions({
  mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
    unwrap(await setCategoryActive(id, isActive)),
  onSuccess: refresh
});
export const deleteCategoryMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await deleteCategory(id)),
  onSuccess: refresh
});

export const createGroupMutation = mutationOptions({
  mutationFn: async (name: string) => unwrap(await createCategoryGroup(name)),
  onSuccess: refresh
});
export const renameGroupMutation = mutationOptions({
  mutationFn: async ({ id, name }: { id: number; name: string }) =>
    unwrap(await renameCategoryGroup(id, name)),
  onSuccess: refresh
});
export const deleteGroupMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await deleteCategoryGroup(id)),
  onSuccess: refresh
});
