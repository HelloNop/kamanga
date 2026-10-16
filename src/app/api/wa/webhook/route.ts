// Webhook WhatsApp Business Cloud API (resmi, Meta).
// GET : verifikasi langganan (hub.verify_token harus sama dengan WA_VERIFY_TOKEN).
// POST: status pesan keluar, tombol Terima/Tolak, dan pesan masuk lain. Tanda tangan X-Hub-Signature-256
//       (HMAC-SHA256 badan mentah dengan WA_APP_SECRET) wajib cocok; selain itu 401.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '@/db';
import { waMessages } from '@/db/schema';
import { booking } from '@/lib/engines/contracts';

type StatusEvent = { id?: string; status?: string; errors?: { code?: number; title?: string }[] };
type Inbound = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
  context?: { id?: string };
};
type Payload = {
  entry?: { changes?: { value?: { statuses?: StatusEvent[]; messages?: Inbound[] } }[] }[];
};

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Status yang sudah lebih maju; pembaruan yang datang terlambat tidak menurunkannya.
const LATER: Record<string, string[]> = {
  sent: ['delivered', 'read'],
  delivered: ['read'],
  read: [],
  failed: []
};

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const token = process.env.WA_VERIFY_TOKEN;
  if (
    token &&
    q.get('hub.mode') === 'subscribe' &&
    safeEqual(q.get('hub.verify_token') ?? '', token)
  )
    return new Response(q.get('hub.challenge') ?? '');
  return new Response('Ditolak', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.WA_APP_SECRET;
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (
    !secret ||
    !safeEqual(signature, `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`)
  )
    return new Response('Tanda tangan tidak valid', { status: 401 });

  let body: Payload;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Badan tidak valid', { status: 400 });
  }
  // Satu kejadian gagal tidak menggagalkan yang lain; Meta tetap diberi 200 agar tidak mengirim ulang semuanya.
  for (const entry of body.entry ?? [])
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) await safely(() => updateStatus(s));
      for (const m of change.value?.messages ?? []) await safely(() => handleMessage(m));
    }
  return new Response('OK');
}

async function safely(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.error('[WA webhook]', e instanceof Error ? e.message : e);
  }
}

async function updateStatus(s: StatusEvent) {
  if (!s.id || !s.status || !(s.status in LATER)) return;
  const status = s.status as 'sent' | 'delivered' | 'read' | 'failed';
  const err = s.errors?.[0];
  await db
    .update(waMessages)
    .set({
      status,
      error: status === 'failed' ? `${err?.code ?? ''} ${err?.title ?? 'gagal'}`.trim() : undefined
    })
    .where(
      and(
        eq(waMessages.providerMessageId, s.id),
        notInArray(waMessages.status, LATER[status] as (typeof status)[])
      )
    );
}

async function handleMessage(m: Inbound) {
  if (!m.id || !m.from) return;
  // Tombol balasan cepat template berisi "accept:<token>" / "reject:<token>" (lihat mesin Notifikasi).
  const payload = m.button?.payload ?? m.interactive?.button_reply?.id ?? '';
  const [, decision, token] = /^(accept|reject):(.+)$/.exec(payload) ?? [];
  // Token tidak dicatat. context = id pesan Kamanga yang dibalas (untuk jawaban pertanyaan warga nanti).
  const params: Record<string, unknown> = {
    type: m.type ?? null,
    text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? null,
    context: m.context?.id ?? null,
    decision: decision ?? null
  };
  // id pesan unik: kiriman ulang Meta untuk pesan yang sama tidak diproses dua kali.
  const [row] = await db
    .insert(waMessages)
    .values({
      direction: 'inbound',
      phone: m.from,
      status: 'delivered',
      mode: 'api',
      providerMessageId: m.id,
      params
    })
    .onConflictDoNothing()
    .returning({ id: waMessages.id });
  if (!row || !decision || !token) return;

  const view = await booking.getBookingForProvider({ token });
  const result = view
    ? await booking.respondBooking(view.id, decision as 'accept' | 'reject', { kind: 'provider' })
    : null;
  await db
    .update(waMessages)
    .set({
      params: {
        ...params,
        bookingId: view?.id ?? null,
        result: !result ? 'not_found' : result.ok ? result.status : result.reason
      }
    })
    .where(eq(waMessages.id, row.id));
}
