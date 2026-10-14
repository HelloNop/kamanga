// Template WA yang bisa diubah admin untuk mode cadangan. Murni (tanpa database), aman di klien.
import type { WaTemplate } from '@/lib/engines/contracts';
import { WA_TEXTS, metaParamKeys } from '@/lib/engines/notify/templates';

export const TEMPLATE_LABELS: Record<WaTemplate, string> = {
  otp: 'Kode masuk warga',
  booking_new: 'Penyedia: pesanan baru',
  booking_contact: 'Penyedia: data pemesan setelah diterima',
  booking_reminder_provider: 'Penyedia: pengingat belum dijawab',
  question_new: 'Penyedia: pertanyaan warga',
  monthly_summary: 'Penyedia: ringkasan bulanan',
  booking_accepted: 'Warga: pesanan diterima',
  booking_rejected: 'Warga: pesanan ditolak',
  booking_expired: 'Warga: pesanan kedaluwarsa',
  booking_cancelled: 'Warga/penyedia: pesanan dibatalkan',
  booking_reminder: 'Warga: pengingat sebelum jadwal',
  review_request: 'Warga: "Puas?" setelah selesai',
  question_answered: 'Warga: jawaban penyedia'
};

// OTP tidak bisa diubah: di mode cadangan kode hanya dicetak ke log, di API memakai template Meta baku.
export const EDITABLE_TEMPLATES = (Object.keys(WA_TEXTS) as WaTemplate[]).filter(
  (t) => t !== 'otp'
);

/** Penanda yang wajib tetap ada: tanpa tautan atau kode, penerima tidak bisa menindaklanjuti. */
const REQUIRED = ['link', 'code'];

/** Masalah pada teks pengganti; null bila boleh dipakai. Teks kosong = memakai bawaan. */
export function templateProblem(template: WaTemplate, text: string): string | null {
  if (!text.trim()) return null;
  const keys = metaParamKeys(template);
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  const unknown = used.find((k) => !keys.includes(k));
  if (unknown) return `Penanda {${unknown}} tidak dikenal untuk pesan ini`;
  const missing = keys.find((k) => REQUIRED.includes(k) && !used.includes(k));
  if (missing) return `Wajib memuat {${missing}}`;
  return null;
}

export { WA_TEXTS, metaParamKeys };
