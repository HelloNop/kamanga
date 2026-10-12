import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { needKeys } from './queries';
import { createNeed, deleteNeed, setNeedActive, updateNeed } from './service';
import type { MutationResult, NeedFormValues } from './types';

const unwrap = (r: MutationResult) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
const refresh = () => getQueryClient().invalidateQueries({ queryKey: needKeys.all });

export const createNeedMutation = mutationOptions({
  mutationFn: async (values: NeedFormValues) => unwrap(await createNeed(values)),
  onSuccess: refresh
});
export const updateNeedMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: NeedFormValues }) =>
    unwrap(await updateNeed(id, values)),
  onSuccess: refresh
});
export const setNeedActiveMutation = mutationOptions({
  mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
    unwrap(await setNeedActive(id, isActive)),
  onSuccess: refresh
});
export const deleteNeedMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await deleteNeed(id)),
  onSuccess: refresh
});
