// POST {phone} → kirim kode OTP masuk warga lewat Mesin Notifikasi. Jawaban tidak pernah memuat kode.
// Langkah berikutnya di klien: authClient.phoneNumber.verify({ phoneNumber: phone, code }).
import { normalizeWhatsapp } from '@/features/listings/lib/format';
import { notify } from '@/lib/engines/contracts';
import { sameOrigin } from '@/lib/kamanga-ai/request';

const ERRORS = {
  invalid_phone: [400, 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890.'],
  rate_limited: [429, 'Terlalu sering meminta kode. Coba lagi beberapa menit lagi.'],
  unavailable: [503, 'Kode belum bisa dikirim lewat WhatsApp. Coba lagi nanti.']
} as const;

export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ ok: false, error: 'Asal permintaan tidak diizinkan' }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = typeof body?.phone === 'string' ? normalizeWhatsapp(body.phone) : null;
  const result = phone
    ? await notify.requestOtp(phone)
    : ({ ok: false, reason: 'invalid_phone' } as const);
  if (result.ok) return Response.json({ ok: true, phone, mode: result.mode });
  const [status, error] = ERRORS[result.reason];
  return Response.json({ ok: false, reason: result.reason, error }, { status });
}
