/* oxlint-disable no-console -- skrip pemeriksaan mencetak hasil */
// Pemeriksaan Mesin Notifikasi WA terhadap DATABASE SUNGGUHAN (kamanga_v2).
// Jalankan: bun run src/lib/engines/notify/notify.check.ts (script: bun run check:notify)
// Data uji memakai nomor 62800999xxxxx dan dihapus di akhir. Env WA_* dihapus sementara (mode cadangan),
// lalu diisi nilai uji untuk jalur API dengan fetch tiruan; tidak ada pesan sungguhan yang dikirim.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { eq, like, sql } from 'drizzle-orm';
import { POST as otpPost } from '@/app/api/wa/otp/route';
import { GET as webhookGet, POST as webhookPost } from '@/app/api/wa/webhook/route';
import { db } from '@/db';
import { waMessages, waOtps } from '@/db/schema';
import {
  appUrl,
  booking,
  notify,
  paths,
  type ProviderBookingView,
  type WaParams,
  type WaTemplate
} from '@/lib/engines/contracts';
import { WA_TEXTS, fill, metaParamKeys } from './templates';

const PREFIX = '62800999';
const num = (n: number) => `${PREFIX}${String(n).padStart(5, '0')}`;
const TOKEN = 'tokUji123';
const tokenLink = appUrl(paths.providerBookingToken(TOKEN));
const citizenLink = appUrl(paths.citizenBooking(1));

const samples: { [K in WaTemplate]: WaParams[K] } = {
  otp: { code: '123456' },
  booking_new: {
    code: 'KMG-UJI1',
    door: 'Ka main',
    listing: '[UJI] Padel Lubeg',
    item: 'Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00',
    details: '4 orang · sewa raket: ya',
    district: 'Lubuk Begalung',
    respondMinutes: 30,
    link: tokenLink
  },
  booking_contact: {
    code: 'KMG-UJI1',
    name: 'Uni Uji',
    phone: num(99),
    address: 'Jl. Uji No. 1',
    note: '',
    link: tokenLink
  },
  booking_reminder_provider: {
    code: 'KMG-UJI1',
    listing: '[UJI] Padel Lubeg',
    item: 'Lapangan Padel 2',
    minutesLeft: 10,
    link: tokenLink
  },
  question_new: {
    listing: '[UJI] Padel Lubeg',
    question: 'Ada musala?',
    link: appUrl(paths.providerQuestions())
  },
  monthly_summary: {
    listing: '[UJI] Padel Lubeg',
    month: 'Oktober 2026',
    bookings: 12,
    newCustomers: 5
  },
  booking_accepted: {
    code: 'KMG-UJI1',
    listing: '[UJI] Padel Lubeg',
    item: 'Sabtu, 18 Okt',
    link: citizenLink
  },
  booking_rejected: {
    code: 'KMG-UJI1',
    listing: '[UJI] Padel Lubeg',
    reason: 'Lapangan diperbaiki',
    link: citizenLink
  },
  booking_expired: { code: 'KMG-UJI1', listing: '[UJI] Padel Lubeg', link: citizenLink },
  booking_cancelled: {
    code: 'KMG-UJI1',
    listing: '[UJI] Padel Lubeg',
    item: 'Lapangan Padel 2 · Sabtu, 18 Okt · 19.00–20.00',
    reason: 'Lapangan sedang diperbaiki',
    link: citizenLink
  },
  booking_reminder: {
    code: 'KMG-UJI1',
    listing: '[UJI] Padel Lubeg',
    item: 'Sabtu, 18 Okt',
    link: citizenLink
  },
  review_request: { code: 'KMG-UJI1', listing: '[UJI] Padel Lubeg', link: citizenLink },
  question_answered: {
    listing: '[UJI] Padel Lubeg',
    question: 'Ada musala?',
    answer: 'Ada, di lantai 2.',
    link: citizenLink
  }
};

const WA_ENV = [
  'WA_PHONE_NUMBER_ID',
  'WA_ACCESS_TOKEN',
  'WA_APP_SECRET',
  'WA_VERIFY_TOKEN',
  'WA_API_VERSION',
  'WA_TEMPLATE_LANG'
];
const savedEnv = Object.fromEntries(WA_ENV.map((k) => [k, process.env[k]]));
const savedNodeEnv = process.env.NODE_ENV;
const origInfo = console.info;
const origFetch = globalThis.fetch;
const origGet = booking.getBookingForProvider;
const origRespond = booking.respondBooking;

// Kode OTP mode cadangan hanya muncul di log server: tangkap dari console.info.
const logs: string[] = [];
console.info = (...a: unknown[]) => void logs.push(a.join(' '));
const lastCode = () => /: (\d{6}) /.exec(logs.at(-1) ?? '')?.[1] ?? '';

const cleanup = async () => {
  await db.delete(waMessages).where(like(waMessages.phone, `${PREFIX}%`));
  await db.delete(waOtps).where(like(waOtps.phone, `${PREFIX}%`));
};
const msg = async (id: number) =>
  (await db.select().from(waMessages).where(eq(waMessages.id, id)))[0];

const sign = (body: string, secret = 'uji-app-secret') =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
const post = (body: string, signature?: string) =>
  webhookPost(
    new Request('http://localhost/api/wa/webhook', {
      method: 'POST',
      headers: signature ? { 'x-hub-signature-256': signature } : {},
      body
    })
  );
const wrap = (value: object) =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'uji', changes: [{ field: 'messages', value }] }]
  });

const verify = (token: string) =>
  webhookGet(
    new Request(
      `http://localhost/api/wa/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=98765`
    )
  );

// Jawaban tiruan Cloud API (diganti per kasus uji).
let reply = () => Response.json({ messages: [{ id: 'wamid.UJI-1' }] });
type SentTemplate = {
  name: string;
  language: { code: string };
  components: {
    sub_type?: string;
    index?: string;
    parameters: { text?: string; payload?: string }[];
  }[];
};

await cleanup();
try {
  for (const k of WA_ENV) delete process.env[k];

  // ───── 1. template ─────
  for (const t of Object.keys(WA_TEXTS) as WaTemplate[]) {
    const params = samples[t] as unknown as Record<string, unknown>;
    const text = fill(WA_TEXTS[t], params);
    assert.doesNotMatch(text, /\{\w+\}/, `${t}: ada penanda yang tidak terisi`);
    for (const k of metaParamKeys(t)) assert.ok(k in params, `${t}: parameter ${k} tidak ada`);
    // Aturan Meta: tidak diawali/diakhiri parameter, tidak ada dua baris kosong berturut-turut.
    assert.doesNotMatch(WA_TEXTS[t], /^\{|\}$|\n\n\n/, `${t}: melanggar aturan template Meta`);
  }
  assert.equal(fill('Halo {name}, {x} {note}', { name: 'Uni', note: '' }), 'Halo Uni, {x} -');
  console.log('1. 12 template terisi lengkap dan memenuhi aturan Meta OK');

  // ───── 2. mode cadangan tanpa env WA ─────
  const fb = await notify.sendWa(
    'booking_new',
    { phone: '0800-999-00001', role: 'provider' },
    samples.booking_new,
    {}
  );
  assert.equal(fb.mode, 'fallback');
  assert.equal(fb.status, 'link');
  assert.equal(fb.link, `https://wa.me/${num(1)}?text=${encodeURIComponent(fb.text)}`);
  assert.ok(fb.text.startsWith('Pesanan baru · Ka main\n[UJI] Padel Lubeg\nLapangan Padel 2'));
  assert.ok(fb.text.includes('Lokasi pemesan: Lubuk Begalung'));
  assert.ok(fb.text.includes(`Terima atau tolak: ${tokenLink}`));
  assert.ok(fb.text.endsWith('Tidak dijawab dalam 30 menit, pesanan ditawarkan ke tempat lain.'));
  const fbRow = await msg(fb.messageId);
  assert.equal(fbRow.direction, 'outbound');
  assert.equal(fbRow.status, 'link');
  assert.equal(fbRow.mode, 'fallback');
  assert.equal(fbRow.phone, num(1));
  assert.equal(fbRow.params.code, 'KMG-UJI1');
  assert.ok(!JSON.stringify(fbRow.params).includes(TOKEN), 'token penyedia tidak boleh tersimpan');

  const contact = await notify.sendWa(
    'booking_contact',
    { phone: num(1), role: 'provider' },
    samples.booking_contact
  );
  assert.ok(contact.text.includes('Catatan: -'));
  const cRow = await msg(contact.messageId);
  for (const k of ['name', 'phone', 'address'])
    assert.ok(!(k in cRow.params), `params memuat ${k}`);

  const bad = await notify.sendWa(
    'booking_expired',
    { phone: '123', role: 'citizen' },
    samples.booking_expired
  );
  assert.equal(bad.status, 'failed');
  assert.ok(bad.link.startsWith('https://wa.me/?text='));
  await db.delete(waMessages).where(eq(waMessages.id, bad.messageId));
  console.log(
    '2. mode cadangan tanpa env: tautan wa.me benar, tercatat, token & data warga tidak disimpan OK'
  );

  // ───── 3. OTP ─────
  // benar dan sekali pakai; yang tersimpan hanya hash
  assert.deepEqual(await notify.requestOtp(num(2)), { ok: true, mode: 'fallback' });
  const c2 = lastCode();
  assert.match(c2, /^\d{6}$/);
  const [stored] = await db
    .select()
    .from(waOtps)
    .where(eq(waOtps.phone, num(2)));
  assert.match(stored.codeHash, /^[0-9a-f]{64}$/);
  assert.ok(!stored.codeHash.includes(c2));
  const [otpMsg] = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.phone, num(2)));
  assert.equal(otpMsg.template, 'otp');
  assert.deepEqual(otpMsg.params, {}, 'params tidak boleh memuat kode OTP');
  assert.deepEqual(await notify.verifyOtp(num(2), c2), { ok: true });
  assert.deepEqual(await notify.verifyOtp(num(2), c2), { ok: false, reason: 'not_found' });

  // salah: percobaan bertambah sampai too_many, lalu kode benar pun ditolak
  await notify.requestOtp(num(3));
  const c3 = lastCode();
  const wrong = c3 === '000000' ? '000001' : '000000';
  for (let i = 1; i <= 4; i++)
    assert.deepEqual(await notify.verifyOtp(num(3), wrong), { ok: false, reason: 'wrong' });
  const [o3] = await db
    .select()
    .from(waOtps)
    .where(eq(waOtps.phone, num(3)));
  assert.equal(o3.attempts, 4);
  assert.deepEqual(await notify.verifyOtp(num(3), wrong), { ok: false, reason: 'too_many' });
  assert.deepEqual(await notify.verifyOtp(num(3), c3), { ok: false, reason: 'too_many' });

  // kedaluwarsa
  await notify.requestOtp(num(4));
  const c4 = lastCode();
  await db
    .update(waOtps)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(waOtps.phone, num(4)));
  assert.deepEqual(await notify.verifyOtp(num(4), c4), { ok: false, reason: 'expired' });

  // hanya kode terbaru yang berlaku; batas 3 kode per 10 menit
  await notify.requestOtp(num(5));
  const c5a = lastCode();
  await notify.requestOtp(num(5));
  const c5b = lastCode();
  if (c5a !== c5b)
    assert.deepEqual(await notify.verifyOtp(num(5), c5a), { ok: false, reason: 'wrong' });
  assert.equal((await notify.requestOtp(num(5))).ok, true);
  assert.deepEqual(await notify.requestOtp(num(5)), { ok: false, reason: 'rate_limited' });

  // batas 10 kode per hari
  await db.insert(waOtps).values(
    Array.from({ length: 10 }, () => ({
      phone: num(6),
      codeHash: 'x',
      expiresAt: new Date(),
      createdAt: sql`now() - interval '2 hours'`
    }))
  );
  assert.deepEqual(await notify.requestOtp(num(6)), { ok: false, reason: 'rate_limited' });

  assert.deepEqual(await notify.requestOtp('12345'), { ok: false, reason: 'invalid_phone' });
  // produksi tanpa API: kode tidak bisa dikirim
  Reflect.set(process.env, 'NODE_ENV', 'production');
  assert.deepEqual(await notify.requestOtp(num(8)), { ok: false, reason: 'unavailable' });
  if (savedNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Reflect.set(process.env, 'NODE_ENV', savedNodeEnv);

  // route: jawaban tidak memuat kode
  const r7 = await otpPost(
    new Request('http://localhost/api/wa/otp', {
      method: 'POST',
      body: JSON.stringify({ phone: '0800 999 00007' })
    })
  );
  const r7text = await r7.text();
  assert.equal(r7.status, 200);
  assert.deepEqual(JSON.parse(r7text), { ok: true, phone: num(7), mode: 'fallback' });
  assert.ok(!r7text.includes(lastCode()));
  const rBad = await otpPost(
    new Request('http://localhost/api/wa/otp', { method: 'POST', body: '{"phone":"abc"}' })
  );
  assert.equal(rBad.status, 400);
  assert.match((await rBad.json()).error, /Nomor WhatsApp tidak valid/);
  console.log(
    '3. OTP: benar sekali pakai, salah→too_many, kedaluwarsa, batas permintaan, hanya hash OK'
  );

  // ───── 4. jalur API resmi (fetch tiruan) ─────
  Object.assign(process.env, {
    WA_PHONE_NUMBER_ID: 'uji-phone-id',
    WA_ACCESS_TOKEN: 'uji-access-token',
    WA_APP_SECRET: 'uji-app-secret',
    WA_VERIFY_TOKEN: 'uji-verify-token'
  });
  const calls: { url: string; auth: string; body: { to: string; template: SentTemplate } }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url: String(url),
      auth: new Headers(init.headers).get('authorization') ?? '',
      body: JSON.parse(String(init.body))
    });
    return reply();
  }) as unknown as typeof fetch;

  const api = await notify.sendWa(
    'booking_new',
    { phone: num(10), role: 'provider' },
    samples.booking_new
  );
  assert.equal(api.mode, 'api');
  assert.equal(api.status, 'sent');
  assert.ok(api.link.startsWith(`https://wa.me/${num(10)}?text=`));
  assert.equal(calls[0].url, 'https://graph.facebook.com/v23.0/uji-phone-id/messages');
  assert.equal(calls[0].auth, 'Bearer uji-access-token');
  const tpl = calls[0].body.template;
  assert.equal(calls[0].body.to, num(10));
  assert.equal(tpl.name, 'kamanga_booking_new');
  assert.equal(tpl.language.code, 'id');
  const bodyParams = tpl.components[0].parameters.map((p) => p.text);
  assert.equal(bodyParams.length, metaParamKeys('booking_new').length);
  assert.ok(bodyParams.every((t) => t && !t.includes('\n')));
  assert.deepEqual(
    tpl.components.slice(1).map((c) => [c.sub_type, c.index, c.parameters[0].payload]),
    [
      ['quick_reply', '0', `accept:${TOKEN}`],
      ['quick_reply', '1', `reject:${TOKEN}`]
    ]
  );
  const apiRow = await msg(api.messageId);
  assert.equal(apiRow.status, 'sent');
  assert.equal(apiRow.mode, 'api');
  assert.equal(apiRow.providerMessageId, 'wamid.UJI-1');
  assert.ok(!JSON.stringify(apiRow.params).includes(TOKEN));

  // API gagal: status failed, tautan cadangan tetap ada
  reply = () => Response.json({ error: { message: 'Template tidak ditemukan' } }, { status: 404 });
  const failed = await notify.sendWa(
    'booking_accepted',
    { phone: num(10), role: 'citizen' },
    samples.booking_accepted
  );
  assert.equal(failed.status, 'failed');
  assert.ok(failed.link.startsWith(`https://wa.me/${num(10)}?text=`));
  assert.match((await msg(failed.messageId)).error ?? '', /Template tidak ditemukan/);

  // OTP lewat API: template autentikasi, kode di badan dan tombol salin, tidak dicetak ke log
  reply = () => Response.json({ messages: [{ id: 'wamid.UJI-OTP' }] });
  const logCount = logs.length;
  assert.deepEqual(await notify.requestOtp(num(11)), { ok: true, mode: 'api' });
  const otpTpl = calls.at(-1)!.body.template;
  assert.equal(otpTpl.name, 'kamanga_otp');
  const otpCode = otpTpl.components[0].parameters[0].text ?? '';
  assert.match(otpCode, /^\d{6}$/);
  assert.equal(otpTpl.components[1].parameters[0].text, otpCode);
  assert.equal(logs.length, logCount);
  assert.deepEqual(await notify.verifyOtp(num(11), otpCode), { ok: true });
  globalThis.fetch = origFetch;
  console.log('4. API resmi: template Meta, tombol Terima/Tolak bertoken, gagal→failed+tautan OK');

  // ───── 5. webhook ─────
  const v1 = await verify('uji-verify-token');
  assert.equal(v1.status, 200);
  assert.equal(await v1.text(), '98765');
  assert.equal((await verify('salah')).status, 403);

  const responded: unknown[][] = [];
  booking.getBookingForProvider = async (access) =>
    'token' in access && access.token === TOKEN
      ? ({ id: 4242 } as unknown as ProviderBookingView)
      : null;
  booking.respondBooking = async (...args) => {
    responded.push(args);
    return { ok: true, status: 'accepted', notices: [] };
  };

  const accept = wrap({
    messages: [
      {
        from: num(20),
        id: 'wamid.UJI-IN-1',
        type: 'button',
        button: { payload: `accept:${TOKEN}`, text: 'Terima' },
        context: { id: 'wamid.UJI-1' }
      }
    ]
  });
  assert.equal((await post(accept, sign(accept, 'rahasia-lain'))).status, 401);
  assert.equal((await post(accept)).status, 401);
  assert.equal((await post(`${accept} `, sign(accept))).status, 401); // badan diubah
  assert.equal(responded.length, 0);

  assert.equal((await post(accept, sign(accept))).status, 200);
  assert.deepEqual(responded, [[4242, 'accept', { kind: 'provider' }]]);
  const [inbound] = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.providerMessageId, 'wamid.UJI-IN-1'));
  assert.equal(inbound.direction, 'inbound');
  assert.equal(inbound.phone, num(20));
  assert.equal(inbound.params.decision, 'accept');
  assert.equal(inbound.params.bookingId, 4242);
  assert.equal(inbound.params.result, 'accepted');
  assert.ok(!JSON.stringify(inbound.params).includes(TOKEN));
  // kiriman ulang Meta tidak diproses dua kali
  assert.equal((await post(accept, sign(accept))).status, 200);
  assert.equal(responded.length, 1);

  // token tak dikenal: tidak memanggil respondBooking
  const unknown = wrap({
    messages: [
      {
        from: num(20),
        id: 'wamid.UJI-IN-2',
        type: 'button',
        button: { payload: 'reject:bukan', text: 'Tolak' }
      }
    ]
  });
  assert.equal((await post(unknown, sign(unknown))).status, 200);
  assert.equal(responded.length, 1);

  // pesan teks biasa dicatat sebagai inbound
  const text = wrap({
    messages: [{ from: num(20), id: 'wamid.UJI-IN-3', type: 'text', text: { body: 'Halo' } }]
  });
  await post(text, sign(text));
  const [inText] = await db
    .select()
    .from(waMessages)
    .where(eq(waMessages.providerMessageId, 'wamid.UJI-IN-3'));
  assert.equal(inText.params.text, 'Halo');

  // status: delivered → read; "sent" yang datang terlambat tidak menurunkan status
  for (const status of ['delivered', 'read', 'sent']) {
    const s = wrap({ statuses: [{ id: 'wamid.UJI-1', status, recipient_id: num(10) }] });
    assert.equal((await post(s, sign(s))).status, 200);
  }
  assert.equal((await msg(api.messageId)).status, 'read');
  console.log(
    '5. webhook: tanda tangan salah→401, Terima→respondBooking(4242), status & pesan masuk OK'
  );
} finally {
  booking.getBookingForProvider = origGet;
  booking.respondBooking = origRespond;
  globalThis.fetch = origFetch;
  console.info = origInfo;
  for (const k of WA_ENV)
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  await cleanup();
}
console.log('Semua pemeriksaan Mesin Notifikasi lulus.');
process.exit(0);
