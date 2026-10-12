'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { MutationResult, ReviewDecision, ReviewDetail, ReviewQueue } from './types';

export async function getReviewQueue(): Promise<ReviewQueue> {
  await requireAdmin();
  return repo.listReviewQueue();
}

export async function getPendingCount(): Promise<number> {
  await requireAdmin();
  return repo.countPendingReview();
}

export async function reviewListing(input: ReviewDecision): Promise<MutationResult> {
  await requireAdmin();
  return repo.reviewListing(input);
}

export async function getReviewDetail(id: number): Promise<ReviewDetail | null> {
  await requireAdmin();
  return repo.getReviewDetail(id);
}
