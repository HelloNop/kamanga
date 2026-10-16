import { mutationOptions } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import type { BlockInput, ExceptionInput, Pattern, QaInput, UnitInput } from '../schemas';
import { mitraKeys } from './queries';
import * as svc from './service';
import type { Fail } from './types';

/** Hasil { ok: false } dijadikan galat agar ditangkap onError useMutation. */
async function must<T extends { ok: boolean }>(p: Promise<T | Fail>) {
  const r = await p;
  if (!r.ok) throw new Error((r as Fail).message);
  return r as Exclude<T, Fail>;
}

const refresh = (key: readonly unknown[]) => () =>
  getQueryClient().invalidateQueries({ queryKey: key });

// ───── Jadwal ─────

export const saveUnitMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { unitId: number | null; input: UnitInput }) =>
      must(svc.saveUnit(listingId, v.unitId, v.input)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const setUnitActiveMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { unitId: number; active: boolean }) =>
      must(svc.setUnitActive(listingId, v.unitId, v.active)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const saveRulesMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { unitId: number; patterns: Pattern[] }) =>
      must(svc.saveRules(listingId, v.unitId, v.patterns)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const saveExceptionMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (input: ExceptionInput) => must(svc.saveException(listingId, input)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const deleteExceptionMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (id: number) => must(svc.deleteException(listingId, id)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const blockSlotMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (input: BlockInput) => must(svc.blockSlot(listingId, input)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

export const unblockSlotMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (blockId: number) => must(svc.unblockSlot(listingId, blockId)),
    onSuccess: refresh(mitraKeys.schedule(listingId))
  });

// ───── Tanya jawab ─────

export const saveQaMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { id: number | null; input: QaInput }) =>
      must(svc.saveQa(listingId, v.id, v.input)),
    onSuccess: refresh(mitraKeys.qa(listingId))
  });

export const deleteQaMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (id: number) => must(svc.deleteQa(listingId, id)),
    onSuccess: refresh(mitraKeys.qa(listingId))
  });

export const moveQaMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { id: number; dir: -1 | 1 }) => must(svc.moveQa(listingId, v.id, v.dir)),
    onSuccess: refresh(mitraKeys.qa(listingId))
  });

export const answerQuestionMutation = (listingId: number) =>
  mutationOptions({
    mutationFn: (v: { id: number; answer: string }) =>
      must(svc.answerQuestion(listingId, v.id, { answer: v.answer })),
    onSuccess: refresh(mitraKeys.qa(listingId))
  });
