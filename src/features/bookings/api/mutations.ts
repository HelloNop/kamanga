import { mutationOptions } from '@tanstack/react-query';
import { overviewKeys } from '@/features/overview/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { bookingKeys } from './queries';
import {
  cancelBookingAsAdmin,
  completeBookingAsAdmin,
  forwardToProvider,
  saveBookingNote
} from './service';
import type { ActionResult, ForwardResult, NoteResult } from './types';

const unwrap = <T extends ActionResult | ForwardResult | NoteResult>(r: T) => {
  if (!r.ok) throw new Error(r.message);
  return r as Extract<T, { ok: true }>;
};
const refresh = () =>
  Promise.all([
    getQueryClient().invalidateQueries({ queryKey: bookingKeys.all }),
    getQueryClient().invalidateQueries({ queryKey: overviewKeys.all })
  ]);

export const forwardMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await forwardToProvider(id)).notice
});
export const cancelBookingMutation = mutationOptions({
  mutationFn: async ({ id, reason }: { id: number; reason: string }) =>
    unwrap(await cancelBookingAsAdmin(id, reason)),
  onSuccess: refresh
});
export const completeBookingMutation = mutationOptions({
  mutationFn: async (id: number) => unwrap(await completeBookingAsAdmin(id)),
  onSuccess: refresh
});
export const saveNoteMutation = mutationOptions({
  mutationFn: async ({ id, note }: { id: number; note: string }) =>
    unwrap(await saveBookingNote(id, note)),
  onSuccess: refresh
});
