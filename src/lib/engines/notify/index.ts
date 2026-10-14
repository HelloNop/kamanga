// Mesin Notifikasi WA (PRD 8.6). Kontrak: ../contracts. Satu adapter, dua jalur:
// - cadangan (bawaan, tanpa env apa pun): tautan wa.me berisi pesan terisi yang ditekan warga/penyedia;
//   kode OTP dicetak ke log server saat pengembangan;
// - WhatsApp Business Cloud API resmi (Meta): hanya bila semua env WA_* wajib diisi.
// Tidak ada jalur WhatsApp tidak resmi. Binding dari ../contracts dipakai hanya di dalam fungsi (impor melingkar).
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { waMessages, waOtps } from '@/db/schema';
import { normalizeWhatsapp } from '@/features/listings/lib/format';
import { getSetting } from '@/lib/settings';
import { paths, type NotifyEngine, type WaSendResult, type WaTemplate } from '../contracts';
import { DECISION_TEMPLATES, WA_TEXTS, fill, metaParamKeys } from './templates';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PER_10_MIN = 3;
const OTP_PER_DAY = 10;

type ApiConfig = { phoneNumberId: string; accessToken: string; version: string; lang: string };

/** Env Cloud API; null = mode cadangan. Rahasia webhook ikut wajib agar tombol Terima/Tolak bisa diterima. */
function apiConfig(): ApiConfig | null {
  const e = process.env;
  if (!e.WA_PHONE_NUMBER_ID || !e.WA_ACCESS_TOKEN || !e.WA_APP_SECRET || !e.WA_VERIFY_TOKEN)
    return null;
  return {
    phoneNumberId: e.WA_PHONE_NUMBER_ID,
    accessToken: e.WA_ACCESS_TOKEN,
    version: e.WA_API_VERSION || 'v23.0',
    lang: e.WA_TEMPLATE_LANG || 'id'
  };
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Tautan /mitra/pesanan/t/<token> → token; null bila bukan tautan token. */
function tokenOf(link: unknown): string | null {
  const prefix = paths.providerBookingToken('');
  const s = typeof link === 'string' ? link : '';
  const i = s.indexOf(prefix);
  return i < 0 ? null : s.slice(i + prefix.length).split(/[/?#]/)[0] || null;
}

/** Isi wa_messages.params: tanpa kode OTP, tanpa data warga (sudah ada di booking_contacts), dan token
 *  penyedia disamarkan karena yang boleh tersimpan hanya hash-nya. */
function loggable(template: WaTemplate, params: Record<string, unknown>) {
  if (template === 'otp') return {};
  const out = { ...params };
  if (template === 'booking_contact')
    for (const k of ['name', 'phone', 'address', 'note']) delete out[k];
  const token = tokenOf(out.link);
  if (token) out.link = String(out.link).replace(token, '…');
  return out;
}

/** Parameter template Meta tidak boleh kosong atau memuat baris baru. */
const metaText = (v: unknown) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim() || '-';

/** Kirim template Meta lewat Cloud API. Mengembalikan id pesan (wamid). */
async function sendTemplate(
  cfg: ApiConfig,
  phone: string,
  template: WaTemplate,
  params: Record<string, unknown>
): Promise<string> {
  const components: object[] = [
    {
      type: 'body',
      parameters: metaParamKeys(template).map((k) => ({ type: 'text', text: metaText(params[k]) }))
    }
  ];
  // Template autentikasi Meta: tombol "salin kode" memuat kode yang sama.
  if (template === 'otp')
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: String(params.code) }]
    });
  const token = DECISION_TEMPLATES.includes(template) ? tokenOf(params.link) : null;
  if (token)
    for (const [i, decision] of (['accept', 'reject'] as const).entries())
      components.push({
        type: 'button',
        sub_type: 'quick_reply',
        index: String(i),
        parameters: [{ type: 'payload', payload: `${decision}:${token}` }]
      });

  const res = await fetch(
    `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: `kamanga_${template}`, language: { code: cfg.lang }, components }
      }),
      signal: AbortSignal.timeout(10_000)
    }
  );
  const data = (await res.json().catch(() => null)) as {
    messages?: { id?: string }[];
    error?: { message?: string; code?: number };
  } | null;
  const id = data?.messages?.[0]?.id;
  if (!res.ok || !id)
    throw new Error(
      `WhatsApp API ${res.status}: ${data?.error?.message ?? 'jawaban tidak dikenal'}`.slice(0, 500)
    );
  return id;
}

function hashOtp(phone: string, code: string) {
  const secret =
    process.env.BETTER_AUTH_SECRET ||
    (process.env.NODE_ENV === 'production' ? null : 'kamanga-dev-secret');
  if (!secret) throw new Error('BETTER_AUTH_SECRET belum diisi');
  return createHmac('sha256', secret + phone)
    .update(code)
    .digest('hex');
}

export const notifyEngine: NotifyEngine = {
  async sendWa(template, to, params, opts) {
    const p = params as unknown as Record<string, unknown>;
    const phone = normalizeWhatsapp(to.phone);
    const custom = (await getSetting('wa.templates'))[template]?.trim();
    const text = fill(custom || WA_TEXTS[template], p);
    const link = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(text)}`;
    const cfg = apiConfig();
    const mode: WaSendResult['mode'] = cfg ? 'api' : 'fallback';

    let status: WaSendResult['status'] = cfg ? 'sent' : 'link';
    let providerMessageId: string | null = null;
    let error: string | null = null;
    if (!phone) {
      status = 'failed';
      error = 'Nomor WhatsApp tidak valid';
    } else if (cfg) {
      try {
        providerMessageId = await sendTemplate(cfg, phone, template, p);
      } catch (e) {
        status = 'failed';
        error = e instanceof Error ? e.message : String(e);
        console.error(`[WA] gagal mengirim ${template}:`, error);
      }
    }

    const [row] = await db
      .insert(waMessages)
      .values({
        direction: 'outbound',
        template,
        phone: phone ?? to.phone,
        status,
        mode,
        bookingId: opts?.bookingId ?? null,
        providerMessageId,
        params: loggable(template, p),
        error
      })
      .returning({ id: waMessages.id });
    return { mode, status, messageId: row.id, link, text };
  },

  async requestOtp(raw) {
    const phone = normalizeWhatsapp(raw);
    if (!phone) return { ok: false, reason: 'invalid_phone' };
    const mode = apiConfig() ? 'api' : 'fallback';
    // Di produksi kode cadangan tidak bisa sampai ke warga (log server bukan saluran).
    if (mode === 'fallback' && process.env.NODE_ENV === 'production')
      return { ok: false, reason: 'unavailable' };

    // Kode lama tidak dibutuhkan lagi; nomor warga jangan disimpan lebih lama dari perlu.
    await db.delete(waOtps).where(sql`${waOtps.createdAt} < now() - interval '2 days'`);
    const [count] = await db
      .select({
        recent:
          sql<number>`count(*) filter (where ${waOtps.createdAt} > now() - interval '10 minutes')`.mapWith(
            Number
          ),
        day: sql<number>`count(*)`.mapWith(Number)
      })
      .from(waOtps)
      .where(and(eq(waOtps.phone, phone), sql`${waOtps.createdAt} > now() - interval '1 day'`));
    // ponytail: hitung lalu sisipkan tanpa kunci; permintaan serentak bisa lolos 1–2 kode lebih.
    if (count.recent >= OTP_PER_10_MIN || count.day >= OTP_PER_DAY)
      return { ok: false, reason: 'rate_limited' };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await db.insert(waOtps).values({
      phone,
      codeHash: hashOtp(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    });
    const sent = await notifyEngine.sendWa('otp', { phone, role: 'citizen' }, { code });
    if (sent.status === 'failed') return { ok: false, reason: 'unavailable' };
    if (mode === 'fallback')
      // oxlint-disable-next-line no-console -- mode cadangan saat pengembangan: kode hanya ada di log server
      console.info(`[OTP cadangan] kode masuk untuk ${phone}: ${code} (berlaku 5 menit)`);
    return { ok: true, mode };
  },

  async verifyOtp(raw, code) {
    const phone = normalizeWhatsapp(raw);
    if (!phone) return { ok: false, reason: 'not_found' };
    // Hanya kode terbaru yang berlaku.
    const [otp] = await db
      .select()
      .from(waOtps)
      .where(eq(waOtps.phone, phone))
      .orderBy(desc(waOtps.id))
      .limit(1);
    if (!otp || otp.consumedAt) return { ok: false, reason: 'not_found' };
    if (otp.expiresAt <= new Date()) return { ok: false, reason: 'expired' };

    // Percobaan dihitung lebih dulu secara atomik agar tebakan serentak tidak melewati batas.
    const [tried] = await db
      .update(waOtps)
      .set({ attempts: sql`${waOtps.attempts} + 1` })
      .where(
        and(eq(waOtps.id, otp.id), lt(waOtps.attempts, OTP_MAX_ATTEMPTS), isNull(waOtps.consumedAt))
      )
      .returning({ attempts: waOtps.attempts });
    if (!tried) return { ok: false, reason: 'too_many' };
    if (!safeEqual(hashOtp(phone, String(code).trim()), otp.codeHash))
      return { ok: false, reason: tried.attempts >= OTP_MAX_ATTEMPTS ? 'too_many' : 'wrong' };

    // Sekali pakai.
    const [used] = await db
      .update(waOtps)
      .set({ consumedAt: new Date() })
      .where(and(eq(waOtps.id, otp.id), isNull(waOtps.consumedAt)))
      .returning({ id: waOtps.id });
    return used ? { ok: true } : { ok: false, reason: 'not_found' };
  }
};
