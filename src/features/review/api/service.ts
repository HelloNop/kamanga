'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import * as claims from '@/features/mitra/api/claims';
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type {
  ClaimDecision,
  MutationResult,
  ReviewDecision,
  ReviewDetail,
  ReviewQueue
} from './types';

export async function getReviewQueue(): Promise<ReviewQueue> {
  await requireAdmin();
  return repo.listReviewQueue();
}

export async function getPendingCount(): Promise<number> {
  await requireAdmin();
  const [listingsWaiting, claimsWaiting] = await Promise.all([
    repo.countPendingReview(),
    claims.countPendingClaims()
  ]);
  return listingsWaiting + claimsWaiting;
}

export async function reviewListing(input: ReviewDecision): Promise<MutationResult> {
  await requireAdmin();
  return repo.reviewListing(input);
}

export async function getReviewDetail(id: number): Promise<ReviewDetail | null> {
  await requireAdmin();
  return repo.getReviewDetail(id);
}

// ───── Klaim usaha (PRD 8.12 langkah 4): tim memverifikasi bila kode WA tidak bisa dipakai ─────

export async function getClaimQueue(): Promise<claims.PendingClaim[]> {
  await requireAdmin();
  return claims.pendingClaims();
}

export async function decideClaim(input: ClaimDecision): Promise<MutationResult> {
  const { user } = await requireAdmin();
  if (!Number.isInteger(input?.id) || input.id <= 0)
    return { ok: false, message: 'Klaim tidak ditemukan' };
  const r =
    input.decision === 'approve'
      ? await claims.approveClaim(input.id, user.id, 'Diverifikasi tim Kamanga')
      : await claims.rejectClaim(input.id, user.id);
  return r.ok ? { ok: true, id: input.id } : r;
}
