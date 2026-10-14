'use server';
// Pintu masuk dari klien. SETIAP fungsi wajib memanggil requireAdmin() lebih dulu.
import { appUrl, notify, paths, type WaSendResult } from '@/lib/engines/contracts';
import { requireAdmin } from '@/lib/session';
import * as repo from './repository';
import type { DemandPeriod, DemandReport, QuestionRow } from './types';

export async function getDemandReport(days: DemandPeriod): Promise<DemandReport> {
  await requireAdmin();
  const safe: DemandPeriod = days === 7 || days === 90 ? days : 30;
  return repo.getDemandReport(safe);
}

export async function getUnansweredQuestions(): Promise<QuestionRow[]> {
  await requireAdmin();
  return repo.listUnansweredQuestions();
}

/** Teruskan pertanyaan warga ke penyedia lewat WA. Mode cadangan: tautan wa.me untuk dikirim tim. */
export async function forwardQuestion(
  id: number
): Promise<{ ok: true; notice: WaSendResult } | { ok: false; message: string }> {
  await requireAdmin();
  const q = await repo.getQuestion(Number(id));
  if (!q) return { ok: false, message: 'Pertanyaan tidak ditemukan' };
  if (q.answer) return { ok: false, message: 'Pertanyaan ini sudah dijawab' };
  if (!q.whatsapp) return { ok: false, message: 'Penyedia belum punya nomor WhatsApp' };
  const notice = await notify.sendWa(
    'question_new',
    { phone: q.whatsapp, role: 'provider' },
    { listing: q.name, question: q.question, link: appUrl(paths.providerQuestions()) }
  );
  return { ok: true, notice };
}
