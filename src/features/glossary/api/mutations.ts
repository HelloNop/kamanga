import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { glossaryKeys } from './queries';
import {
  createGlossaryTerm,
  deleteGlossaryTerm,
  setGlossaryChecked,
  updateGlossaryTerm
} from './service';
import type { GlossaryFormValues, MutationResult } from './types';

const unwrap = (r: MutationResult) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
const refresh = () => getQueryClient().invalidateQueries({ queryKey: glossaryKeys.all });

export const createGlossaryMutation = mutationOptions({
  mutationFn: async (values: GlossaryFormValues) => unwrap(await createGlossaryTerm(values)),
  onSuccess: refresh
});
export const updateGlossaryMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: GlossaryFormValues }) =>
    unwrap(await updateGlossaryTerm(id, values)),
  onSuccess: refresh
});
export const setCheckedMutation = mutationOptions({
  mutationFn: async ({ id, isChecked }: { id: number; isChecked: boolean }) =>
    unwrap(await setGlossaryChecked(id, isChecked)),
  onSuccess: refresh
});
export const deleteGlossaryMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await deleteGlossaryTerm(id)),
  onSuccess: refresh
});
