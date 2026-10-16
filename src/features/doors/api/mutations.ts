import { mutationOptions } from '@tanstack/react-query';
import { categoryKeys } from '@/features/categories/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { doorKeys } from './queries';
import { createDoor, moveDoor, updateDoor } from './service';
import type { DoorFormValues, MutationResult } from './types';

const unwrap = (r: MutationResult) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};
// Nama pintu juga tampil di daftar kategori.
const refresh = () =>
  Promise.all([
    getQueryClient().invalidateQueries({ queryKey: doorKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: categoryKeys.all })
  ]);

export const createDoorMutation = mutationOptions({
  mutationFn: async (values: DoorFormValues) => unwrap(await createDoor(values)),
  onSuccess: refresh
});
export const updateDoorMutation = mutationOptions({
  mutationFn: async ({ id, values }: { id: number; values: DoorFormValues }) =>
    unwrap(await updateDoor(id, values)),
  onSuccess: refresh
});
export const moveDoorMutation = mutationOptions({
  mutationFn: async ({ id, dir }: { id: number; dir: 'up' | 'down' }) =>
    unwrap(await moveDoor(id, dir)),
  onSuccess: refresh
});
