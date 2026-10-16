// Uji ujung-ke-ujung TANPA browser (agent-penguji, Gelombang 4), mode cadangan WA.
// Mesin dipanggil lewat kontrak, server action dan halaman lewat HTTP ke server dev yang sedang berjalan.
// Prasyarat: `bun run dev` di E2E_BASE_URL (bawaan http://localhost:3000), database kamanga_v2 dengan data acuan,
// wilayah Padang, dan listing dummy; halaman /pesan, /pesanan/[id], /akun, /masuk, /mitra, /dashboard/bookings
// sudah pernah dibuka (server action baru terdaftar di manifest dev setelah halamannya dikompilasi).
// Data uji: akun e2e-<run>-…@test.invalid, nomor 62899…, pesanan, blokir, dan sesi chat buatan sendiri. Semua
// dihapus di finally; owner_id listing dummy yang dipinjam dikembalikan.
// Jalankan: bun run tests/e2e.check.ts   (usulan script: check:e2e)
/* oxlint-disable no-console -- skrip uji: hasilnya dicetak ke terminal */
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/auth-schema';
import {
  bookingContacts,
  bookings,
  chatSessions,
  listings,
  llmCalls,
  savedAddresses,
  searchLogs,
  slotBlocks,
  waMessages,
  waOtps
} from '@/db/schema';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import { getBookingTarget } from '@/features/warga/api/repository';
import { buildRules } from '@/features/warga/lib/format';
import { findProviders, type ProviderCard } from '@/lib/directory/providers';
import {
  booking,
  type CreateBookingInput,
  location,
  notify,
  paths,
  schedule,
  type Slot,
  type WaSendResult
} from '@/lib/engines/contracts';
import { addDays, fromJakarta, jakartaDate } from '@/lib/engines/time';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const STARTED = new Date();
const F = {
  warga: 'src/features/warga/api/service.ts',
  search: 'src/features/warga/api/search.ts',
  mitra: 'src/features/mitra/api/service.ts',
  token: 'src/features/mitra/api/token-actions.ts',
  admin: 'src/features/bookings/api/service.ts'
};
/** Cookie sesi palsu: lolos proxy (yang hanya mengecek ada tidaknya cookie), ditolak require*() di server. */
const FAKE_SESSION = 'better-auth.session_token=palsu.palsu';
const HOUR = 3_600_000;

// ───────────────────────────── catatan hasil ─────────────────────────────

const results: { name: string; ok: boolean; error?: string }[] = [];
const findings: string[] = [];
async function part(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`LULUS  ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ name, ok: false, error: msg });
    console.log(`GAGAL  ${name}\n       ${msg.split('\n').slice(0, 8).join('\n       ')}`);
  }
}
/** Pemeriksaan yang tidak menghentikan alur; tetap membuat skrip gagal di akhir. */
function expect(cond: unknown, msg: string) {
  if (cond) return;
  findings.push(msg);
  console.log(`TEMUAN ${msg}`);
}

// ───────────────────────────── data uji yang harus dibersihkan ─────────────────────────────

const users: string[] = [];
const phones: string[] = [];
const bookingIds: number[] = [];
const blockIds: number[] = [];
const chatIds: string[] = [];
const ownerRestore = new Map<number, string | null>();
const secrets: string[] = []; // token penyedia dan kode OTP yang tidak boleh tersimpan polos
const addresses: string[] = [];

// ───────────────────────────── HTTP ─────────────────────────────

type Res = { status: number; location: string | null; text: string; cookies: string[] };
async function http(
  path: string,
  o: { cookie?: string; body?: unknown; headers?: Record<string, string>; method?: string } = {}
): Promise<Res> {
  const res = await fetch(BASE + path, {
    method: o.method ?? (o.body === undefined ? 'GET' : 'POST'),
    redirect: 'manual',
    headers: {
      origin: BASE,
      ...(o.cookie ? { cookie: o.cookie } : {}),
      ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...o.headers
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
  return {
    status: res.status,
    location: res.headers.get('location'),
    text: await res.text(),
    cookies: res.headers.getSetCookie()
  };
}
const jar = (setCookies: string[]) =>
  setCookies
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
    .join('; ');

const RUNTIME_ERROR =
  /id="__next_error__"|Unhandled Runtime Error|Internal Server Error|Application error/;
/** Buka halaman; 200 tanpa galat runtime, atau pengalihan ke `to`. */
async function page(path: string, cookie: string | undefined, want: number, to?: RegExp) {
  const r = await http(path, { cookie });
  assert.equal(
    r.status,
    want,
    `${path}: status ${r.status}${r.location ? ` → ${r.location}` : ''}${cookie ? '' : ' (tanpa sesi)'}`
  );
  if (to) assert.match(r.location ?? '', to, `${path} dialihkan ke ${r.location}`);
  if (want === 200) assert.ok(!RUNTIME_ERROR.test(r.text), `${path}: ada galat runtime di HTML`);
  return r;
}

// ───────────────────────────── server action lewat HTTP ─────────────────────────────

type ManifestEntry = { filename: string; exportedName: string; workers: Record<string, unknown> };
let manifest: Record<string, ManifestEntry> = {};
function findAction(file: string, name: string) {
  for (let i = 0; i < 2; i++) {
    for (const [id, v] of Object.entries(manifest))
      if (v.filename === file && v.exportedName === name)
        return { id, workers: Object.keys(v.workers) };
    manifest = JSON.parse(
      readFileSync('.next/dev/server/server-reference-manifest.json', 'utf8')
    ).node;
  }
  throw new Error(
    `server action ${name} (${file}) belum ada di manifest dev; buka halamannya sekali`
  );
}
/** "app/(publik)/pesan/[slug]/page" → "/pesan/<slug>". Urutan pilihan: halaman yang semua segmen dinamisnya
 *  diisi `fill` (mis. token), lalu halaman tanpa segmen dinamis, lalu yang pertama. */
const params = (w: string) => [...w.matchAll(/\[(\w+)\]/g)].map((m) => m[1]);
function workerPath(workers: string[], fill: Record<string, string>) {
  const pick =
    workers.find((w) => params(w).length > 0 && params(w).every((k) => k in fill)) ??
    workers.find((w) => params(w).length === 0) ??
    workers[0];
  return (
    pick
      .replace(/^app/, '')
      .replace(/\/page$/, '')
      .replace(/\/\([^)]+\)/g, '')
      .replace(/\[(\w+)\]/g, (_, k: string) => fill[k] ?? '1') || '/'
  );
}
type Act = { status: number; redirect: string | null; value: unknown; text: string };
/** Panggil server action seperti klien Next: POST ke halaman yang memuatnya dengan header Next-Action. */
async function act(
  file: string,
  name: string,
  args: unknown[],
  cookie?: string,
  fill: Record<string, string> = {}
): Promise<Act> {
  const a = findAction(file, name);
  const res = await fetch(BASE + workerPath(a.workers, fill), {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'next-action': a.id,
      'content-type': 'text/plain;charset=UTF-8',
      accept: 'text/x-component',
      origin: BASE,
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(args)
  });
  const text = await res.text();
  // Hasil ada di baris "1:<json>" (format RSC); baris "1:D…" adalah info debug.
  const line = text.split('\n').findLast((l) => /^1:[[{"\dtfn-]/.test(l));
  let value: unknown;
  try {
    value = line ? JSON.parse(line.slice(2)) : undefined;
  } catch {
    value = undefined;
  }
  return { status: res.status, redirect: res.headers.get('x-action-redirect'), value, text };
}
const okOf = (r: Act) => (r.value as { ok?: boolean } | null | undefined)?.ok === true;
/** Ditolak: dialihkan oleh require*(), galat (throw), atau hasil {ok:false}/null. Tidak pernah data. */
const denied = (r: Act) =>
  Boolean(r.redirect) ||
  r.status >= 300 ||
  /^1:E/m.test(r.text) ||
  r.value === null ||
  (r.value as { ok?: boolean } | undefined)?.ok === false;

// ───────────────────────────── akun uji ─────────────────────────────

type Citizen = { id: string; phone: string; name: string; cookie: string };
type Staff = { id: string; email: string; cookie: string };

function newPhone() {
  const p = `62899${String(randomInt(10_000_000)).padStart(7, '0')}`;
  phones.push(p);
  return p;
}

/** Kode OTP mode cadangan hanya tercetak ke log: tangkap dari console.info proses ini. */
async function otpCode(phone: string) {
  const logs: string[] = [];
  const orig = console.info;
  console.info = (...a: unknown[]) => void logs.push(a.join(' '));
  try {
    const r = await notify.requestOtp(phone, null);
    assert.ok(r.ok, `requestOtp: ${JSON.stringify(r)}`);
  } finally {
    console.info = orig;
  }
  const code = logs.join('\n').match(new RegExp(`${phone}: (\\d{6})`))?.[1];
  assert.ok(code, 'kode OTP cadangan tidak tercetak ke log');
  secrets.push(code);
  return code;
}

/** Masuk warga lewat HTTP: OTP → /api/auth/phone-number/verify → nama + persetujuan privasi. */
async function citizenLogin(label: string, phone = newPhone()): Promise<Citizen> {
  const code = await otpCode(phone);
  const v = await http('/api/auth/phone-number/verify', { body: { phoneNumber: phone, code } });
  assert.equal(v.status, 200, `verifikasi OTP: ${v.status} ${v.text.slice(0, 200)}`);
  const cookie = jar(v.cookies);
  const [u] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.phoneNumber, phone));
  assert.ok(u, 'akun warga terbentuk');
  users.push(u.id);
  assert.equal(u.role, 'citizen');
  const name = `Warga Uji ${label} ${RUN}`;
  const p = await act(F.warga, 'completeProfile', [{ name, consent: true }], cookie);
  assert.ok(okOf(p), `completeProfile: ${p.text.slice(0, 200)}`);
  return { id: u.id, phone, name, cookie };
}

/** Mitra / admin: daftar email lewat HTTP (selalu menjadi mitra), peran admin dinaikkan di DB, lalu masuk. */
async function staffLogin(label: string, role: 'vendor' | 'admin'): Promise<Staff> {
  const email = `e2e-${RUN}-${label}@test.invalid`;
  const password = randomBytes(18).toString('base64url');
  const su = await http('/api/auth/sign-up/email', {
    body: { email, password, name: `[UJI] ${label}` }
  });
  assert.equal(su.status, 200, `daftar ${label}: ${su.text.slice(0, 200)}`);
  const [u] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email));
  users.push(u.id);
  assert.equal(u.role, 'vendor', 'daftar dengan email selalu menjadi mitra');
  if (role === 'admin') await db.update(user).set({ role: 'admin' }).where(eq(user.id, u.id));
  const si = await http('/api/auth/sign-in/email', { body: { email, password } });
  assert.equal(si.status, 200, `masuk ${label}: ${si.text.slice(0, 200)}`);
  return { id: u.id, email, cookie: jar(si.cookies) };
}

// ───────────────────────────── pembantu pesanan ─────────────────────────────

const localPhone = (p: string) => `0${p.slice(2)}`;
/** Teks yang dilihat penyedia sebelum menerima tidak boleh memuat nomor, nama, atau alamat warga. */
function hidesContact(
  where: string,
  s: string,
  c: { phone: string; name: string },
  address?: string
) {
  const lp = localPhone(c.phone);
  for (const bad of [
    c.phone,
    lp,
    `${lp.slice(0, 4)} ${lp.slice(4, 8)} ${lp.slice(8)}`,
    c.name,
    ...(address ? [address] : [])
  ])
    assert.ok(!s.includes(bad), `${where} memuat data warga "${bad}" sebelum diterima`);
}

function tokenOf(notice: Pick<WaSendResult, 'link'>) {
  const text = decodeURIComponent(notice.link.split('text=')[1] ?? '');
  const token = text.match(/\/mitra\/pesanan\/t\/([\w-]+)/)?.[1];
  assert.ok(token, 'tautan token Terima/Tolak tidak ada di pesan');
  secrets.push(token);
  return { token, text };
}

async function rulesOf(slug: string) {
  const t = await getBookingTarget(slug);
  assert.ok(t?.category && t.bookable, `${slug} tidak bisa dipesan`);
  return {
    t: { ...t, category: t.category },
    rules: buildRules(parseAttributeSchema(t.category.attributeSchema), t.listing.attributes)
      .snapshot
  };
}

const used = new Set<string>();
/** Slot kosong pertama dari penyedia yang bisa dipesan, yang belum dipakai uji lain. */
function freeSlot(items: ProviderCard[], need = 1): { card: ProviderCard; slot: Slot } {
  for (const card of items)
    if (card.bookable)
      for (const slot of card.slots) {
        const k = `${slot.unitId}|${slot.startsAt.toISOString()}`;
        if (slot.seatsLeft >= need && !used.has(k)) {
          used.add(k);
          return { card, slot };
        }
      }
  throw new Error('tidak ada slot kosong yang tersisa untuk diuji');
}

const status = async (id: number) =>
  (await db.select({ s: bookings.status }).from(bookings).where(eq(bookings.id, id)))[0]?.s;

type FlowInput = {
  door: string;
  card: ProviderCard;
  citizen: Citizen;
  slot?: { unitId: number; startsAt: Date; endsAt: Date; seats?: number };
  request?: CreateBookingInput['request'];
  seats?: number;
  address?: string;
  districtId?: number | null;
  /** Pemeriksaan privasi tambahan saat pesanan masih `sent`. */
  beforeAccept?: (id: number, code: string, token: string) => Promise<void>;
};

let admin: Staff;

/** findProviders → createBooking → diteruskan tim → token → Terima → status warga. */
async function flow(f: FlowInput) {
  const { t, rules } = await rulesOf(f.card.slug);
  if (f.address) addresses.push(f.address);
  const res = await booking.createBooking({
    citizenId: f.citizen.id,
    listingId: t.listing.id,
    categoryId: t.category.id,
    slot: f.slot,
    request: f.request,
    seats: f.seats,
    districtId: f.districtId ?? null,
    contact: {
      name: f.citizen.name,
      phone: f.citizen.phone,
      address: f.address ?? null,
      point: null,
      note: `catatan rahasia ${RUN}`
    },
    details: {},
    rulesAccepted: rules
  });
  assert.ok(res.ok, `${f.door}: createBooking gagal ${JSON.stringify(res)}`);
  const id = res.bookingId;
  bookingIds.push(id);

  // 1. Dikirim: warga melihat status "sent"; pesan ke penyedia berisi kecamatan, tanpa kontak warga.
  assert.equal((await booking.getBookingForCitizen(id, f.citizen.id))?.status, 'sent');
  assert.ok(res.providerNotice.link.startsWith('https://wa.me/62'), 'pesan ke nomor penyedia');
  assert.equal(res.providerNotice.mode, 'fallback', 'mode cadangan (tanpa env WA)');
  const first = tokenOf(res.providerNotice);
  hidesContact(`${f.door}: pesan booking_new`, first.text, f.citizen, f.address);
  assert.ok(!first.text.includes(`catatan rahasia ${RUN}`), 'catatan warga bocor sebelum diterima');

  // 2. Tim meneruskan dari dashboard admin (mode cadangan, rencana keputusan 8).
  const fwd = await act(F.admin, 'forwardToProvider', [id], admin.cookie);
  const fv = fwd.value as { ok?: boolean; notice?: WaSendResult } | undefined;
  assert.ok(fv?.ok && fv.notice, `forwardToProvider: ${fwd.text.slice(0, 300)}`);
  const { token, text } = tokenOf(fv.notice);
  assert.equal(token, first.token, 'tautan token kiriman ulang sama dengan pesan pertama');
  hidesContact(`${f.door}: pesan diteruskan tim`, text, f.citizen, f.address);

  // 3. Penyedia membuka tautan token: kontak tertutup, hanya kecamatan.
  const pv = await booking.getBookingForProvider({ token });
  assert.ok(
    pv && pv.status === 'sent' && pv.contact === null,
    'token: kontak null sebelum diterima'
  );
  if (f.districtId) assert.ok(pv.district, 'kecamatan terlihat sebelum diterima');
  hidesContact(`${f.door}: data token`, JSON.stringify(pv), f.citizen, f.address);
  const tokenPage = await page(paths.providerBookingToken(token), undefined, 200);
  assert.ok(tokenPage.text.includes(res.code), 'halaman token menampilkan pesanan');
  hidesContact(`${f.door}: HTML halaman token`, tokenPage.text, f.citizen, f.address);
  const citizenPage = await page(paths.citizenBooking(id), f.citizen.cookie, 200);
  assert.ok(citizenPage.text.includes(res.code), 'warga melihat pesanannya');
  assert.ok(!citizenPage.text.includes(token), 'halaman warga memuat token Terima/Tolak penyedia');
  if (f.beforeAccept) await f.beforeAccept(id, res.code, token);

  // 4. Terima lewat token (server action halaman token, tanpa login).
  const acc = await act(F.token, 'actWithToken', [token, 'accept'], undefined, { token });
  assert.ok(okOf(acc), `${f.door}: terima lewat token: ${acc.text.slice(0, 300)}`);
  const after = await booking.getBookingForProvider({ token });
  assert.equal(after?.status, 'accepted');
  assert.equal(after?.contact?.phone, f.citizen.phone, 'kontak terbuka setelah diterima');
  if (f.address) assert.equal(after?.contact?.address, f.address);
  const opened = await page(paths.providerBookingToken(token), undefined, 200);
  assert.ok(opened.text.includes(f.citizen.name), 'nama warga tampil setelah diterima');

  // 5. Warga melihat statusnya.
  assert.equal((await booking.getBookingForCitizen(id, f.citizen.id))?.status, 'accepted');
  await page(paths.citizenBooking(id), f.citizen.cookie, 200);
  return { id, code: res.code, token };
}

/** Penyedia menandai selesai (lewat token) → warga mengulas (server action) → ulasan kedua ditolak. */
async function finishAndReview(door: string, id: number, token: string, c: Citizen) {
  let done = await act(F.token, 'actWithToken', [token, 'complete'], undefined, { token });
  if (!okOf(done) && (await status(id)) !== 'completed') {
    // Bila mesin menolak menandai selesai sebelum jadwal, majukan jadwal ke kemarin lalu coba lagi.
    const y = fromJakarta(addDays(jakartaDate(new Date()), -1), '10:00');
    await db
      .update(bookings)
      .set({ startsAt: y, endsAt: new Date(y.getTime() + HOUR) })
      .where(eq(bookings.id, id));
    done = await act(F.token, 'actWithToken', [token, 'complete'], undefined, { token });
  }
  assert.ok(
    okOf(done) || (await status(id)) === 'completed',
    `${door}: tandai selesai: ${done.text.slice(0, 300)}`
  );
  assert.equal(await status(id), 'completed');
  const review = { satisfied: true, stars: 5, comment: `Mantap (uji ${RUN})` };
  const rv = await act(F.warga, 'submitReviewAction', [id, review], c.cookie, { id: String(id) });
  assert.ok(okOf(rv), `${door}: ulasan: ${rv.text.slice(0, 300)}`);
  const again = await act(F.warga, 'submitReviewAction', [id, review], c.cookie, {
    id: String(id)
  });
  assert.ok(!okOf(again), 'ulasan kedua ditolak');
  const v = await booking.getBookingForCitizen(id, c.id);
  assert.equal(v?.review?.satisfied, true);
  await page(paths.citizenBooking(id), c.cookie, 200);
}

// ───────────────────────────── titik uji (koordinat perangkat) ─────────────────────────────

const one = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as T;
const loc = (slug: string) =>
  one<{ id: number; lat: number; lng: number }>(
    sql`select id, lat, lng from locations where slug = ${slug}`
  );
const catId = async (slug: string) =>
  Number((await one<{ id: number }>(sql`select id from categories where slug = ${slug}`)).id);

// Titik perangkat P (di Kuranji) dengan digit khas agar bisa dicari di seluruh database.
const P = { lat: -0.8927271828, lng: 100.4120314159 };
const P_DIGITS = /0\.892727|100\.412031/;
// Kontrol positif Q: disimpan sengaja sebagai alamat warga, harus ketemu oleh pemindai yang sama.
const Q = { lat: -0.8931161803, lng: 100.4111414213 };
const Q_DIGITS = /0\.893116|100\.411141/;

/** Jumlah baris per tabel yang teksnya memuat pola koordinat. */
async function scanCoordinates(re: RegExp) {
  const tables = (
    await db.execute(sql`select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'spatial_ref_sys'`)
  ).rows.map((r) => String(r.table_name));
  const hits: Record<string, number> = {};
  for (const t of tables) {
    const r = await one<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(t)} x where x::text ~ ${re.source}`
    );
    if (Number(r.n) > 0) hits[t] = Number(r.n);
  }
  return hits;
}

// ───────────────────────────── jalankan ─────────────────────────────

const countAll = async () => {
  const r = await one<Record<string, number>>(sql`select
    (select count(*) from bookings)::int as bookings,
    (select count(*) from "user")::int as users,
    (select count(*) from wa_messages)::int as wa_messages,
    (select count(*) from wa_otps)::int as wa_otps,
    (select count(*) from slot_blocks)::int as slot_blocks,
    (select count(*) from chat_sessions)::int as chat_sessions,
    (select count(*) from search_logs)::int as search_logs,
    (select count(*) from saved_addresses)::int as saved_addresses,
    (select count(*) from reviews)::int as reviews,
    (select count(*) from listings where owner_id is not null)::int as owned_listings`);
  return r;
};

const dbName = (await one<{ d: string }>(sql`select current_database() as d`)).d;
assert.equal(dbName, 'kamanga_v2', 'uji hanya boleh jalan di kamanga_v2');
const before = await countAll();
console.log('Hitungan awal:', JSON.stringify(before));

const tomorrow = addDays(jakartaDate(new Date()), 1);
const evening = { from: fromJakarta(tomorrow, '18:00'), to: fromJakarta(tomorrow, '23:00') };
const IDS = {
  padel: await catId('padel-court'),
  barber: await catId('barbershop'),
  travel: await catId('intercity-travel'),
  ac: await catId('ac-repair')
};
const lubeg = await loc('lubuk-begalung');
const kuranji = await loc('kuranji');
const padangBarat = await loc('padang-barat');
const bukittinggi = await loc('bukittinggi');
const payakumbuh = await loc('payakumbuh');

let A: Citizen, B: Citizen, D: Citizen, V1: Staff, V2: Staff;
const flows: Record<string, { id: number; code: string; token: string; slug: string }> = {};
let padelListingId = 0;

try {
  await part(
    '0. server dev menyala dan akun uji (OTP warga lewat HTTP, mitra, admin)',
    async () => {
      const home = await http('/');
      assert.equal(home.status, 200, `server dev di ${BASE} tidak menjawab 200`);
      admin = await staffLogin('admin', 'admin');
      V1 = await staffLogin('mitra1', 'vendor');
      V2 = await staffLogin('mitra2', 'vendor');
      A = await citizenLogin('A');
      B = await citizenLogin('B');
      D = await citizenLogin('D');
    }
  );

  // ───── empat alur warga ─────
  await part(
    '1. Ka main: padel besok malam dekat Lubeg, 4 orang (+ privasi pemilik dan mitra lain)',
    async () => {
      const r = await findProviders({
        categoryIds: [IDS.padel],
        origin: { lat: lubeg.lat, lng: lubeg.lng },
        when: evening,
        seats: 4,
        sort: 'distance'
      });
      const { card, slot } = freeSlot(r.items);
      const [l] = await db
        .select({ id: listings.id, ownerId: listings.ownerId })
        .from(listings)
        .where(eq(listings.slug, card.slug));
      padelListingId = l.id;
      ownerRestore.set(l.id, l.ownerId);
      await db.update(listings).set({ ownerId: V1.id }).where(eq(listings.id, l.id));
      await page(paths.bookingStart(card.slug, { ...slot, seats: 4 }), undefined, 200);

      const f = await flow({
        door: 'Ka main',
        card,
        citizen: A,
        slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt, seats: 4 },
        seats: 4,
        districtId: lubeg.id,
        beforeAccept: async (id, code, token) => {
          // Pemilik berakun: kontak tertutup di mesin, daftar, dan HTML dashboard.
          const own = await booking.getBookingForProvider({ bookingId: id, userId: V1.id });
          assert.ok(own && own.contact === null, 'pemilik: kontak null sebelum diterima');
          const list = await booking.listBookings({ listingIds: [l.id] });
          hidesContact('listBookings', JSON.stringify(list), A);
          for (const p of ['/mitra', '/mitra/pesanan', `/mitra/pesanan/${id}`])
            hidesContact(`HTML ${p} (pemilik)`, (await page(p, V1.cookie, 200)).text, A);
          assert.ok(
            (await http(`/mitra/pesanan/${id}`, { cookie: V1.cookie })).text.includes(code)
          );
          // Mitra lain: tidak bisa membaca atau mengubah.
          assert.equal(await booking.getBookingForProvider({ bookingId: id, userId: V2.id }), null);
          const other = await http(`/mitra/pesanan/${id}`, { cookie: V2.cookie });
          assert.ok(!other.text.includes(code), 'mitra lain melihat pesanan');
          const g = await act(F.mitra, 'getBooking', [id], V2.cookie);
          assert.equal(g.value, null, `getBooking oleh mitra lain: ${g.text.slice(0, 200)}`);
          assert.ok(denied(await act(F.mitra, 'actOnMyBooking', [id, 'accept'], V2.cookie)));
          // Warga lain dan tanpa sesi.
          assert.ok(
            denied(
              await act(F.warga, 'cancelBookingAction', [id, 'iseng'], B.cookie, { id: String(id) })
            )
          );
          await page(paths.citizenBooking(id), B.cookie, 404);
          await page(paths.citizenBooking(id), undefined, 307, /\/masuk/);
          assert.ok(denied(await act(F.mitra, 'actOnMyBooking', [id, 'accept'], FAKE_SESSION)));
          assert.ok(
            denied(
              await act(F.token, 'actWithToken', [`${token.slice(0, -2)}xx`, 'accept'], undefined, {
                token
              })
            )
          );
          assert.ok(
            denied(await act(F.token, 'actWithToken', [token, 'cancel'], undefined, { token })),
            'batal lewat token ditolak'
          );
          assert.equal(
            await status(id),
            'sent',
            'status tidak berubah oleh pihak yang tidak berhak'
          );
        }
      });
      flows.main = { ...f, slug: card.slug };
      // Kontak terbuka untuk pemilik setelah diterima; mitra lain tetap tidak.
      const own = await booking.getBookingForProvider({ bookingId: f.id, userId: V1.id });
      assert.equal(own?.contact?.phone, A.phone);
      assert.equal(await booking.getBookingForProvider({ bookingId: f.id, userId: V2.id }), null);
      // PRD 8.5: selesai ditandai penyedia setelah layanan, atau otomatis setelah slot lewat.
      const early = await act(F.token, 'actWithToken', [f.token, 'complete'], undefined, {
        token: f.token
      });
      expect(
        !okOf(early),
        'Ka main: penyedia bisa menandai pesanan "selesai" sebelum jadwalnya dimulai (besok malam)'
      );
      await finishAndReview('Ka main', f.id, f.token, A);
    }
  );

  await part('2. Ka rawat diri: barbershop slot 30 menit', async () => {
    const r = await findProviders({
      categoryIds: [IDS.barber],
      origin: { lat: kuranji.lat, lng: kuranji.lng },
      when: { from: fromJakarta(tomorrow, '09:00'), to: fromJakarta(tomorrow, '17:00') },
      sort: 'distance'
    });
    const { card, slot } = freeSlot(r.items);
    assert.equal(slot.endsAt.getTime() - slot.startsAt.getTime(), 30 * 60_000, 'slot 30 menit');
    await page(paths.bookingStart(card.slug, { ...slot, seats: 1 }), A.cookie, 200);
    const f = await flow({
      door: 'Ka rawat diri',
      card,
      citizen: A,
      slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt, seats: 1 },
      districtId: kuranji.id
    });
    flows.rawat = { ...f, slug: card.slug };
    await finishAndReview('Ka rawat diri', f.id, f.token, A);
  });

  await part(
    '3. Ka uda anta: travel Padang → Bukittinggi besok pagi, 2 kursi, jemput Padang Barat',
    async () => {
      const [fromId] = await location.serviceRegionIds();
      const r = await findProviders({
        categoryIds: [IDS.travel],
        origin: { lat: padangBarat.lat, lng: padangBarat.lng },
        prefer: 'call',
        route: { fromId, toId: bukittinggi.id },
        when: { from: fromJakarta(tomorrow, '05:00'), to: fromJakarta(tomorrow, '12:00') },
        seats: 2,
        sort: 'distance'
      });
      const { card, slot } = freeSlot(r.items, 3);
      await page(paths.bookingStart(card.slug, { ...slot, seats: 2 }), A.cookie, 200);
      const before = slot.seatsLeft;
      const f = await flow({
        door: 'Ka uda anta',
        card,
        citizen: B,
        slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt, seats: 2 },
        seats: 2,
        address: `Jl. Uji Jemput No. ${randomInt(100, 999)}, Padang Barat`,
        districtId: padangBarat.id
      });
      flows.travel = { ...f, slug: card.slug };
      const [left] = await schedule.getAvailability({
        unitIds: [slot.unitId],
        from: slot.startsAt,
        to: new Date(slot.startsAt.getTime() + 60_000),
        includeTaken: true
      });
      assert.equal(left?.seatsLeft, before - 2, 'sisa kursi berkurang 2');
      await finishAndReview('Ka uda anta', f.id, f.token, B);
    }
  );

  await part('4. Ka servis: servis AC permintaan dengan alamat di Kuranji', async () => {
    const r = await findProviders({
      categoryIds: [IDS.ac],
      origin: { lat: kuranji.lat, lng: kuranji.lng },
      prefer: 'call',
      sort: 'distance'
    });
    const card = r.items.find((c) => c.bookable);
    assert.ok(card, 'ada teknisi AC yang melayani Kuranji');
    assert.ok(await location.isInServiceArea(card.id, { lat: kuranji.lat, lng: kuranji.lng }));
    await page(paths.bookingStart(card.slug), A.cookie, 200);
    const f = await flow({
      door: 'Ka servis',
      card,
      citizen: B,
      request: { problem: 'AC tidak dingin dan menetes', preferredDate: tomorrow, period: 'pagi' },
      address: `Jl. Uji Servis No. ${randomInt(100, 999)}, Kuranji`,
      districtId: kuranji.id
    });
    flows.servis = { ...f, slug: card.slug };
    await finishAndReview('Ka servis', f.id, f.token, B);
  });

  // ───── anti-bentrok ─────
  await part(
    '5. anti-bentrok: dua pesanan BERSAMAAN untuk slot padel yang sama (mesin)',
    async () => {
      const r = await findProviders({ categoryIds: [IDS.padel], when: evening, sort: 'distance' });
      const { card, slot } = freeSlot(r.items);
      const { t, rules } = await rulesOf(card.slug);
      const input = (c: Citizen): CreateBookingInput => ({
        citizenId: c.id,
        listingId: t.listing.id,
        categoryId: t.category.id,
        slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt },
        contact: { name: c.name, phone: c.phone },
        rulesAccepted: rules
      });
      const res = await Promise.all([
        booking.createBooking(input(A)),
        booking.createBooking(input(B))
      ]);
      for (const x of res) if (x.ok) bookingIds.push(x.bookingId);
      const ok = res.filter((x) => x.ok);
      assert.equal(
        ok.length,
        1,
        `tepat satu berhasil, hasil: ${JSON.stringify(res.map((x) => x.ok || x.reason))}`
      );
      const lost = res.find((x) => !x.ok);
      assert.ok(
        lost && !lost.ok && lost.reason === 'taken',
        `yang kalah: taken (${JSON.stringify(lost)})`
      );
      // Slot yang sudah ditahan tidak lagi tampil kosong.
      const free = await schedule.getAvailability({
        unitIds: [slot.unitId],
        from: slot.startsAt,
        to: slot.endsAt
      });
      assert.ok(!free.some((s) => s.startsAt.getTime() === slot.startsAt.getTime()));
    }
  );

  await part(
    '6. anti-bentrok lewat HTTP: dua warga menekan Kirim bersamaan (server action, titik perangkat)',
    async () => {
      const r = await findProviders({ categoryIds: [IDS.padel], when: evening, sort: 'distance' });
      const { card, slot } = freeSlot(r.items);
      const { rules } = await rulesOf(card.slug);
      const body = {
        slug: card.slug,
        slot: {
          unitId: slot.unitId,
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          seats: 2
        },
        request: null,
        loc: { source: 'device', point: P, label: 'Lokasi saya' },
        address: '',
        note: '',
        racket: false,
        rules
      };
      const res = await Promise.all(
        [A, B].map((c) =>
          act(F.warga, 'createBookingAction', [body], c.cookie, { slug: card.slug })
        )
      );
      const vals = res.map(
        (x) => x.value as { ok?: boolean; href?: string; error?: string } | undefined
      );
      for (const v of vals) {
        const id = Number(v?.href?.match(/\/pesanan\/(\d+)/)?.[1]);
        if (id) bookingIds.push(id);
      }
      assert.equal(
        vals.filter((v) => v?.ok).length,
        1,
        `tepat satu berhasil: ${JSON.stringify(vals)}`
      );
      const lost = vals.find((v) => !v?.ok);
      assert.match(
        lost?.error ?? '',
        /diambil|terisi|kosong|jadwal lain/i,
        'pesan ramah untuk yang kalah'
      );
      // Jawaban ke warga tidak memuat tautan wa.me penyedia atau token.
      for (const x of res)
        assert.ok(
          !/wa\.me|\/mitra\/pesanan\/t\//.test(x.text),
          'jawaban warga memuat tautan penyedia'
        );
    }
  );

  await part('7. anti-bentrok kursi travel: kursi terakhir diperebutkan bersamaan', async () => {
    const [fromId] = await location.serviceRegionIds();
    const r = await findProviders({
      categoryIds: [IDS.travel],
      route: { fromId, toId: bukittinggi.id },
      when: { from: fromJakarta(tomorrow, '05:00'), to: fromJakarta(tomorrow, '23:00') },
      seats: 2
    });
    const { card, slot } = freeSlot(r.items, 2);
    const { t, rules } = await rulesOf(card.slug);
    const input = (c: Citizen, seats: number): CreateBookingInput => ({
      citizenId: c.id,
      listingId: t.listing.id,
      categoryId: t.category.id,
      slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt, seats },
      seats,
      districtId: padangBarat.id,
      contact: { name: c.name, phone: c.phone, address: 'Jl. Uji Kursi 1' },
      rulesAccepted: rules
    });
    const fill = await booking.createBooking(input(A, slot.seatsLeft - 1));
    assert.ok(fill.ok, `isi kursi kecuali satu: ${JSON.stringify(fill)}`);
    bookingIds.push(fill.bookingId);
    const res = await Promise.all([
      booking.createBooking(input(A, 1)),
      booking.createBooking(input(B, 1))
    ]);
    for (const x of res) if (x.ok) bookingIds.push(x.bookingId);
    assert.equal(
      res.filter((x) => x.ok).length,
      1,
      `tepat satu dapat kursi terakhir: ${JSON.stringify(res.map((x) => x.ok || x.reason))}`
    );
    const lost = res.find((x) => !x.ok);
    assert.ok(lost && !lost.ok && lost.reason === 'no_seats');
    const more = await booking.createBooking(input(B, 1));
    assert.ok(!more.ok && more.reason === 'no_seats', 'kursi penuh');
  });

  await part(
    '8. blokir slot: tidak tampil kosong, pesanan ditolak, blokir di atas pesanan ditolak',
    async () => {
      const r = await findProviders({ categoryIds: [IDS.padel], when: evening, sort: 'distance' });
      const { card, slot } = freeSlot(r.items);
      const blk = await schedule.blockSlot({
        unitId: slot.unitId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        reason: 'walk_in',
        note: `uji ${RUN}`,
        actor: { kind: 'provider', userId: V1.id }
      });
      assert.ok(blk.ok, `blockSlot: ${JSON.stringify(blk)}`);
      blockIds.push(blk.id);
      const free = await schedule.getAvailability({
        unitIds: [slot.unitId],
        from: slot.startsAt,
        to: slot.endsAt
      });
      assert.ok(
        !free.some((s) => s.startsAt.getTime() === slot.startsAt.getTime()),
        'slot diblokir tampil kosong'
      );
      const { t, rules } = await rulesOf(card.slug);
      const res = await booking.createBooking({
        citizenId: A.id,
        listingId: t.listing.id,
        categoryId: t.category.id,
        slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt },
        contact: { name: A.name, phone: A.phone },
        rulesAccepted: rules
      });
      if (res.ok) bookingIds.push(res.bookingId);
      assert.ok(!res.ok && res.reason === 'blocked', `pesan slot diblokir: ${JSON.stringify(res)}`);
      // Blokir di atas pesanan aktif (pesanan Ka main yang sudah selesai tidak dihitung; pakai pesanan bagian 5).
      const active = await db
        .select({ unitId: bookings.unitId, startsAt: bookings.startsAt, endsAt: bookings.endsAt })
        .from(bookings)
        .where(
          and(
            inArray(bookings.id, bookingIds),
            eq(bookings.status, 'sent'),
            eq(bookings.exclusive, true)
          )
        )
        .limit(1);
      assert.ok(
        active[0]?.unitId && active[0].startsAt && active[0].endsAt,
        'ada pesanan aktif untuk diuji'
      );
      const clash = await schedule.blockSlot({
        unitId: active[0].unitId,
        startsAt: active[0].startsAt,
        endsAt: active[0].endsAt,
        reason: 'other',
        actor: { kind: 'provider', userId: V1.id }
      });
      if (clash.ok) blockIds.push(clash.id);
      assert.ok(
        !clash.ok && clash.reason === 'conflict',
        `blokir di atas pesanan: ${JSON.stringify(clash)}`
      );
    }
  );

  // ───── keamanan server action dan route ─────
  await part(
    '9. keamanan: server action tanpa sesi / peran salah / milik orang lain ditolak',
    async () => {
      const id = flows.main?.id ?? bookingIds[0];
      assert.ok(id, 'butuh pesanan dari bagian sebelumnya');
      const blocksBefore = (await db.select({ id: slotBlocks.id }).from(slotBlocks)).length;
      const [anyUnit] = await db
        .execute(sql`select id from units where listing_id = ${padelListingId} limit 1`)
        .then((r) => r.rows as { id: number }[]);
      const [foreignUnit] = await db
        .execute(sql`select id from units where listing_id <> ${padelListingId} limit 1`)
        .then((r) => r.rows as { id: number }[]);
      const blockInput = (unitId: number) => ({
        unitId: Number(unitId),
        startsAt: `$D${fromJakarta(addDays(tomorrow, 1), '06:00').toISOString()}`,
        endsAt: `$D${fromJakarta(addDays(tomorrow, 1), '07:00').toISOString()}`,
        reason: 'other',
        note: `uji ${RUN}`
      });
      const cases: [string, Act][] = [
        [
          'warga tanpa sesi: createBookingAction',
          await act(F.warga, 'createBookingAction', [{}], undefined, { slug: flows.main.slug })
        ],
        [
          'warga tanpa sesi: cancelBookingAction',
          await act(F.warga, 'cancelBookingAction', [id, 'x'], undefined, { id: String(id) })
        ],
        ['warga tanpa sesi: deleteAccount', await act(F.warga, 'deleteAccount', ['HAPUS'])],
        [
          'warga B: submitReviewAction pesanan A',
          await act(
            F.warga,
            'submitReviewAction',
            [flows.rawat?.id ?? id, { satisfied: false, stars: 1, comment: 'x' }],
            B.cookie,
            { id: String(id) }
          )
        ],
        [
          'mitra tanpa sesi: getHome',
          await act(F.mitra, 'getHome', [padelListingId], FAKE_SESSION)
        ],
        [
          'mitra tanpa sesi: blockSlot',
          await act(F.mitra, 'blockSlot', [padelListingId, blockInput(anyUnit.id)], FAKE_SESSION)
        ],
        [
          'mitra lain: getHome usaha orang',
          await act(F.mitra, 'getHome', [padelListingId], V2.cookie)
        ],
        [
          'mitra lain: blockSlot usaha orang',
          await act(F.mitra, 'blockSlot', [padelListingId, blockInput(anyUnit.id)], V2.cookie)
        ],
        [
          'pemilik: blockSlot unit usaha lain',
          await act(F.mitra, 'blockSlot', [padelListingId, blockInput(foreignUnit.id)], V1.cookie)
        ],
        ['warga: aksi mitra getHome', await act(F.mitra, 'getHome', [padelListingId], A.cookie)],
        [
          'tanpa sesi: forwardToProvider (admin)',
          await act(F.admin, 'forwardToProvider', [id], FAKE_SESSION)
        ],
        [
          'mitra: forwardToProvider (admin)',
          await act(F.admin, 'forwardToProvider', [id], V1.cookie)
        ],
        [
          'mitra: getBookingById (admin, berisi kontak)',
          await act(F.admin, 'getBookingById', [id], V1.cookie)
        ],
        ['warga: getBookingById (admin)', await act(F.admin, 'getBookingById', [id], A.cookie)],
        [
          'token palsu: actWithToken',
          await act(F.token, 'actWithToken', ['A'.repeat(43), 'accept'], undefined, {
            token: 'A'.repeat(43)
          })
        ]
      ];
      for (const [name, r] of cases) {
        assert.ok(denied(r), `${name} TIDAK ditolak: ${r.status} ${r.text.slice(0, 200)}`);
        hidesContact(name, r.text, A);
        for (const s of secrets) assert.ok(!r.text.includes(s), `${name} membocorkan token/OTP`);
      }
      const blocksAfter = (await db.select({ id: slotBlocks.id }).from(slotBlocks)).length;
      assert.equal(
        blocksAfter,
        blocksBefore,
        'tidak ada blokir yang terbuat oleh pihak tak berhak'
      );
      // Pembanding positif: pemilik memblokir unitnya sendiri dengan masukan yang sama → berhasil.
      const ownBlock = await act(
        F.mitra,
        'blockSlot',
        [padelListingId, blockInput(anyUnit.id)],
        V1.cookie
      );
      const ob = ownBlock.value as { ok?: boolean; id?: number } | undefined;
      if (ob?.id) blockIds.push(ob.id);
      assert.ok(ob?.ok, `pemilik blockSlot unit sendiri: ${ownBlock.text.slice(0, 200)}`);
      // Admin memang boleh (pembanding positif agar pemanggilan di atas tidak sekadar salah format).
      const adm = await act(F.admin, 'getBookingById', [id], admin.cookie);
      assert.ok(
        (adm.value as { id?: number } | null)?.id === id,
        `admin getBookingById: ${adm.text.slice(0, 200)}`
      );
      const home = await act(F.mitra, 'getHome', [padelListingId], V1.cookie);
      assert.ok(
        Array.isArray((home.value as { tasks?: unknown[] } | null)?.tasks),
        'pemilik getHome'
      );
    }
  );

  await part(
    '10. keamanan route: cron, webhook WA, OTP lintas asal, daftar dengan peran/nomor',
    async () => {
      const cron = await http('/api/cron/bookings', { method: 'POST' });
      assert.ok([401, 503].includes(cron.status), `cron tanpa rahasia: ${cron.status}`);
      const cronBad = await http('/api/cron/bookings', {
        method: 'POST',
        headers: { authorization: 'Bearer salah' }
      });
      assert.ok([401, 503].includes(cronBad.status), `cron rahasia salah: ${cronBad.status}`);
      if (cron.status === 503)
        console.log('       catatan: CRON_SECRET belum diatur; /api/cron/bookings menjawab 503');
      const wh = await http('/api/wa/webhook', { body: { entry: [] } });
      assert.equal(wh.status, 401, 'webhook tanpa tanda tangan');
      const whGet = await http(
        '/api/wa/webhook?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=1'
      );
      assert.equal(whGet.status, 403);
      const otp = await http('/api/wa/otp', {
        body: { phone: newPhone() },
        headers: { origin: 'https://jahat.example' }
      });
      assert.equal(otp.status, 403, 'OTP dari asal lain ditolak');
      const noOrigin = await fetch(`${BASE}/api/wa/otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: newPhone() })
      });
      assert.equal(noOrigin.status, 403, 'OTP tanpa Origin (skrip) ditolak');

      // Daftar dengan email sambil mengisi `role` sendiri: peran tidak boleh ikut.
      const password = randomBytes(18).toString('base64url');
      const roleEmail = `e2e-${RUN}-peran@test.invalid`;
      await http('/api/auth/sign-up/email', {
        body: { email: roleEmail, password, name: 'Penyusup', role: 'admin' }
      });
      const [roleRow] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.email, roleEmail));
      if (roleRow) users.push(roleRow.id);
      assert.ok(roleRow?.role !== 'admin', 'daftar bisa memilih peran admin');

      // Daftar dengan email sambil mengisi `phoneNumber` milik orang lain (belum diverifikasi).
      const victim = newPhone();
      const email = `e2e-${RUN}-penyusup@test.invalid`;
      const su = await http('/api/auth/sign-up/email', {
        body: { email, password, name: 'Penyusup', phoneNumber: victim }
      });
      const [row] = await db
        .select({ id: user.id, role: user.role, phone: user.phoneNumber })
        .from(user)
        .where(eq(user.email, email));
      if (row) users.push(row.id);
      expect(
        !row?.phone,
        `daftar email menerima phoneNumber dari formulir (HTTP ${su.status}): terbentuk akun "${row?.role}" bernomor ${victim} yang belum diverifikasi`
      );
      if (row?.phone) {
        // Penyusup bisa memakai akun itu untuk memesan atas nama nomor orang lain.
        const si = await http('/api/auth/sign-in/email', { body: { email, password } });
        const cookie = jar(si.cookies);
        const prof = await act(
          F.warga,
          'completeProfile',
          [{ name: 'Penyusup', consent: true }],
          cookie
        );
        expect(
          !okOf(prof),
          'akun dengan nomor belum terverifikasi bisa melengkapi profil warga (lalu memesan atas nama nomor orang lain)'
        );
        // Pemilik nomor asli lalu masuk dengan OTP: apakah ia masuk ke akun buatan penyusup?
        const real = await citizenLogin('korban', victim);
        expect(
          real.id !== row.id,
          'pengambilalihan akun: warga yang masuk dengan OTP masuk ke akun yang dibuat penyusup lewat daftar email'
        );
        if (real.id === row.id) {
          const again = await http('/api/auth/sign-in/email', { body: { email, password } });
          const peek = await http('/pesanan', { cookie: jar(again.cookies) });
          expect(
            again.status !== 200 || peek.status !== 200,
            'penyusup tetap bisa masuk dengan email + sandi ke akun warga itu dan membuka /pesanan miliknya'
          );
        }
      }
    }
  );

  // ───── privasi: koordinat perangkat, log WA, hapus akun ─────
  await part(
    '11. privasi koordinat: pencarian/chat/pesan dengan titik perangkat tidak menyimpan titik',
    async () => {
      assert.deepEqual(await scanCoordinates(P_DIGITS), {}, 'titik uji sudah ada sebelum uji');
      const rp = await act(F.search, 'resolveDevicePoint', [P], undefined, { slug: 'ka-main' });
      assert.ok(okOf(rp), `resolveDevicePoint: ${rp.text.slice(0, 200)}`);
      const device = { source: 'device', point: P, label: 'Lokasi saya' };
      for (const [door, categoryId, extra] of [
        ['ka-main', IDS.padel, {}],
        ['ka-rawat-diri', IDS.barber, {}],
        ['ka-uda-anta', IDS.travel, { destinationId: payakumbuh.id }],
        ['ka-servis', IDS.ac, {}]
      ] as const) {
        const s = await act(
          F.search,
          'searchDoor',
          [
            {
              categoryId,
              loc: device,
              date: tomorrow,
              period: 'semua',
              seats: 1,
              destinationId: null,
              relax: {},
              ...extra
            }
          ],
          undefined,
          { slug: door }
        );
        const v = s.value as { ok?: boolean; items?: unknown[]; error?: string } | undefined;
        assert.ok(v?.ok, `searchDoor ${door}: ${s.text.slice(0, 200)}`);
        expect(
          (v.items?.length ?? 0) > 0,
          `searchDoor ${door} dengan titik di Kuranji: tidak ada hasil`
        );
      }
      // Chat dengan lokasi perangkat.
      const chat = await http('/api/chat', {
        body: {
          text: 'ado lapangan padel kosong nanti malam?',
          action: { kind: 'location' },
          point: P
        }
      });
      const sid = chat.cookies.map((c) => c.match(/^kamanga_sid=([^;]+)/)?.[1]).find(Boolean);
      if (sid) chatIds.push(decodeURIComponent(sid));
      assert.equal(chat.status, 200, `chat: ${chat.status} ${chat.text.slice(0, 200)}`);
      // Pesanan Ka servis lewat server action dengan titik perangkat + alamat ketik (warga D).
      const ac = (
        await findProviders({ categoryIds: [IDS.ac], origin: P, prefer: 'call' })
      ).items.find((c) => c.bookable);
      assert.ok(ac, 'ada teknisi AC untuk titik P');
      const { rules } = await rulesOf(ac.slug);
      const address = `Jl. Uji Hapus No. ${randomInt(100, 999)}, Kuranji`;
      addresses.push(address);
      const cb = await act(
        F.warga,
        'createBookingAction',
        [
          {
            slug: ac.slug,
            slot: null,
            request: { problem: 'AC berisik', preferredDate: tomorrow, period: 'siang' },
            loc: device,
            address,
            note: '',
            racket: false,
            rules
          }
        ],
        D.cookie,
        { slug: ac.slug }
      );
      const cv = cb.value as { ok?: boolean; href?: string } | undefined;
      const dId = Number(cv?.href?.match(/\/pesanan\/(\d+)/)?.[1]);
      assert.ok(cv?.ok && dId, `createBookingAction Ka servis: ${cb.text.slice(0, 300)}`);
      bookingIds.push(dId);
      flows.hapus = { id: dId, code: '', token: '', slug: ac.slug };
      const [c] = await db.select().from(bookingContacts).where(eq(bookingContacts.bookingId, dId));
      assert.equal(c?.lat, null, 'titik perangkat tersimpan di booking_contacts');
      assert.ok(
        (await db.select().from(bookings).where(eq(bookings.id, dId)))[0]?.districtId,
        'kecamatan dari titik'
      );
      // Kontrol positif: warga sengaja menyimpan titik Q sebagai alamat.
      const sa = await act(
        F.warga,
        'addSavedAddress',
        [{ label: 'Rumah', address, loc: { source: 'device', point: Q, label: 'Lokasi saya' } }],
        D.cookie
      );
      assert.ok(okOf(sa), `addSavedAddress: ${sa.text.slice(0, 200)}`);

      const pHits = await scanCoordinates(P_DIGITS);
      const qHits = await scanCoordinates(Q_DIGITS);
      assert.ok(
        qHits.saved_addresses >= 1,
        `pemindai tidak menemukan kontrol positif: ${JSON.stringify(qHits)}`
      );
      assert.deepEqual(pHits, {}, `titik perangkat tersimpan di: ${JSON.stringify(pHits)}`);
    }
  );

  await part(
    '12. privasi log WA: wa_messages.params tanpa nomor/nama/alamat warga, token, atau OTP',
    async () => {
      const rows = await db
        .select({
          template: waMessages.template,
          params: waMessages.params,
          phone: waMessages.phone
        })
        .from(waMessages)
        .where(or(inArray(waMessages.bookingId, bookingIds), inArray(waMessages.phone, phones)));
      assert.ok(rows.length > 10, `pesan WA tercatat (${rows.length})`);
      const citizens = [A, B, D].filter(Boolean);
      for (const r of rows) {
        const s = JSON.stringify(r.params);
        for (const c of citizens) hidesContact(`wa_messages.params (${r.template})`, s, c);
        for (const a of addresses)
          assert.ok(!s.includes(a), `wa_messages.params (${r.template}) memuat alamat`);
        for (const x of secrets)
          assert.ok(!s.includes(x), `wa_messages.params (${r.template}) memuat token/OTP`);
        if (r.template === 'otp') assert.deepEqual(r.params, {});
      }
      assert.ok(
        rows.some((r) => r.template === 'booking_contact'),
        'pesan data warga ke penyedia tercatat'
      );
    }
  );

  await part(
    '13. hapus akun warga: kontak, alamat, OTP, nomor di log WA terhapus; pesanan tetap anonim',
    async () => {
      const id = flows.hapus?.id;
      assert.ok(id, 'butuh pesanan warga D dari bagian 11');
      const fwd = await act(F.admin, 'forwardToProvider', [id], admin.cookie);
      const { token } = tokenOf((fwd.value as { notice: WaSendResult }).notice);
      assert.ok(okOf(await act(F.token, 'actWithToken', [token, 'accept'], undefined, { token })));
      assert.equal((await booking.getBookingForProvider({ token }))?.contact?.phone, D.phone);
      const del = await act(F.warga, 'deleteAccount', ['HAPUS'], D.cookie);
      assert.ok(okOf(del), `deleteAccount: ${del.text.slice(0, 200)}`);
      assert.equal(
        (await db.select().from(user).where(eq(user.id, D.id))).length,
        0,
        'akun terhapus'
      );
      const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
      assert.ok(b && b.citizenId === null, 'pesanan tetap ada tanpa pemilik');
      expect(
        b.status === 'cancelled',
        `pesanan aktif warga yang dihapus berstatus ${b.status}, bukan cancelled`
      );
      assert.equal(
        (await db.select().from(bookingContacts).where(eq(bookingContacts.bookingId, id))).length,
        0
      );
      assert.equal(
        (await db.select().from(savedAddresses).where(eq(savedAddresses.userId, D.id))).length,
        0
      );
      assert.equal((await db.select().from(waOtps).where(eq(waOtps.phone, D.phone))).length, 0);
      assert.equal(
        (await db.select().from(waMessages).where(eq(waMessages.phone, D.phone))).length,
        0,
        'nomor di log WA'
      );
      assert.equal(
        (await booking.getBookingForProvider({ token }))?.contact ?? null,
        null,
        'penyedia tidak lagi melihat kontak'
      );
      await page('/pesanan', D.cookie, 307, /\/masuk/);
    }
  );

  await part(
    '15. ditolak dan kedaluwarsa: warga diberi tahu, alternatif ditawarkan, kontak tetap tertutup',
    async () => {
      const r = await findProviders({
        categoryIds: [IDS.barber],
        when: { from: fromJakarta(tomorrow, '09:00'), to: fromJakarta(tomorrow, '17:00') }
      });
      const mk = async () => {
        const { card, slot } = freeSlot(r.items);
        const { t, rules } = await rulesOf(card.slug);
        const res = await booking.createBooking({
          citizenId: A.id,
          listingId: t.listing.id,
          categoryId: t.category.id,
          slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt },
          districtId: kuranji.id,
          contact: { name: A.name, phone: A.phone },
          rulesAccepted: rules
        });
        assert.ok(res.ok, JSON.stringify(res));
        bookingIds.push(res.bookingId);
        return { id: res.bookingId, token: tokenOf(res.providerNotice).token };
      };
      // Ditolak lewat token: tombol "kabari warga" tidak boleh membawa nomor warga ke penyedia.
      const rej = await mk();
      const rr = await act(F.token, 'actWithToken', [rej.token, 'reject', 'Penuh'], undefined, {
        token: rej.token
      });
      assert.ok(okOf(rr), `tolak lewat token: ${rr.text.slice(0, 200)}`);
      hidesContact('jawaban aksi Tolak ke penyedia', rr.text, A);
      assert.equal((await booking.getBookingForProvider({ token: rej.token }))?.contact, null);
      const rv = await booking.getBookingForCitizen(rej.id, A.id);
      assert.equal(rv?.status, 'rejected');
      assert.ok(
        (await booking.findAlternatives(rej.id, 3)).length > 0,
        'alternatif setelah ditolak'
      );
      const rejPage = await page(paths.citizenBooking(rej.id), A.cookie, 200);
      assert.match(rejPage.text, /Penuh/, 'alasan penolakan tampil ke warga');
      // Kedaluwarsa: batas waktu lewat → berubah saat dibaca, warga diberi tahu, token terlambat.
      const exp = await mk();
      await db
        .update(bookings)
        .set({ respondBy: new Date(Date.now() - 60_000) })
        .where(eq(bookings.id, exp.id));
      assert.equal((await booking.getBookingForCitizen(exp.id, A.id))?.status, 'expired');
      const notified = await db
        .select({ t: waMessages.template })
        .from(waMessages)
        .where(eq(waMessages.bookingId, exp.id));
      assert.ok(
        notified.some((n) => n.t === 'booking_expired'),
        'warga diberi tahu kedaluwarsa'
      );
      assert.ok(
        !okOf(
          await act(F.token, 'actWithToken', [exp.token, 'accept'], undefined, { token: exp.token })
        ),
        'terima setelah kedaluwarsa'
      );
      assert.equal((await booking.getBookingForProvider({ token: exp.token }))?.contact, null);
      // Slot yang ditolak/kedaluwarsa kembali kosong.
      const [b] = await db.select().from(bookings).where(eq(bookings.id, exp.id));
      const free = await schedule.getAvailability({
        unitIds: [b.unitId!],
        from: b.startsAt!,
        to: b.endsAt!
      });
      assert.ok(
        free.some((s) => s.startsAt.getTime() === b.startsAt!.getTime()),
        'slot kedaluwarsa kembali kosong'
      );
    }
  );

  await part('16. hapus akun saat pesanan diterima sudah di dalam batas pembatalan', async () => {
    const E = await citizenLogin('E');
    const r = await findProviders({
      categoryIds: [IDS.padel],
      // Di dalam batas pembatalan padel dummy (1 hari): 1–20 jam dari sekarang.
      when: { from: new Date(Date.now() + HOUR), to: new Date(Date.now() + 20 * HOUR) }
    });
    const { card, slot } = freeSlot(r.items);
    const { t, rules } = await rulesOf(card.slug);
    assert.ok(
      (rules.cancelBeforeMinutes ?? 0) * 60_000 > slot.startsAt.getTime() - Date.now(),
      'slot uji berada di dalam batas pembatalan'
    );
    const res = await booking.createBooking({
      citizenId: E.id,
      listingId: t.listing.id,
      categoryId: t.category.id,
      slot: { unitId: slot.unitId, startsAt: slot.startsAt, endsAt: slot.endsAt },
      districtId: lubeg.id,
      contact: { name: E.name, phone: E.phone },
      rulesAccepted: rules
    });
    assert.ok(res.ok, JSON.stringify(res));
    bookingIds.push(res.bookingId);
    const { token } = tokenOf(res.providerNotice);
    assert.ok(okOf(await act(F.token, 'actWithToken', [token, 'accept'], undefined, { token })));
    const del = await act(F.warga, 'deleteAccount', ['HAPUS'], E.cookie);
    assert.ok(okOf(del), `deleteAccount: ${del.text.slice(0, 200)}`);
    const st = await status(res.bookingId);
    const told = await db
      .select({ t: waMessages.template })
      .from(waMessages)
      .where(eq(waMessages.bookingId, res.bookingId));
    expect(
      st === 'cancelled' && told.some((n) => n.t === 'booking_cancelled'),
      `hapus akun: pesanan yang sudah diterima dan lewat batas pembatalan tetap "${st}" tanpa pemberitahuan ke penyedia, padahal kontak warga sudah terhapus`
    );
    assert.equal((await booking.getBookingForProvider({ token }))?.contact ?? null, null);
  });

  await part('17. beranda: pintu dari tabel doors, tanpa akun, tanpa memanggil AI', async () => {
    const calls = async () =>
      (await one<{ n: number }>(sql`select count(*)::int as n from llm_calls`)).n;
    const n0 = await calls();
    const home = await page('/', undefined, 200);
    assert.equal(await calls(), n0, 'beranda memanggil AI');
    const doorRows = (await db.execute(sql`select name, status from doors`)).rows as {
      name: string;
      status: string;
    }[];
    for (const d of doorRows) {
      if (d.status === 'hidden')
        assert.ok(!home.text.includes(`>${d.name}<`), `pintu tersembunyi ${d.name} tampil`);
      else assert.ok(home.text.includes(d.name), `pintu ${d.name} (${d.status}) tidak tampil`);
    }
    assert.match(home.text, /Kamanga hari ko/);
    assert.match(home.text, /href="\/masuk[^"]*">Masuk</, 'header beranda: Masuk untuk warga');
    // Chat pindah ke beranda: alamat lama dialihkan, pesan ?q= ikut terbawa.
    await page('/chat', undefined, 307, /^\/$/);
    await page('/chat?q=servis%20ac', undefined, 307, /^\/\?q=servis%20ac$/);
  });

  // ───── halaman per peran ─────
  await part('18. halaman per peran: 200/307 sesuai peran, tanpa galat runtime', async () => {
    const main = flows.main;
    assert.ok(main, 'butuh pesanan Ka main');
    // Tamu
    for (const p of [
      '/',
      '/pintu/ka-main',
      '/pintu/ka-rawat-diri',
      '/pintu/ka-uda-anta',
      '/pintu/ka-servis',
      '/masuk'
    ])
      await page(p, undefined, 200);
    for (const f of Object.values(flows)) await page(paths.bookingStart(f.slug), undefined, 200);
    await page('/pesanan', undefined, 307, /\/masuk/);
    await page(paths.citizenBooking(main.id), undefined, 307, /\/masuk/);
    await page('/akun', undefined, 307, /\/masuk/);
    await page('/mitra', undefined, 307, /\/auth\/sign-in/);
    await page('/dashboard/overview', undefined, 307, /\/auth\/sign-in/);
    await page(paths.providerBookingToken('A'.repeat(43)), undefined, 200);
    // Warga
    for (const p of ['/', '/pesanan', paths.citizenBooking(main.id), '/akun'])
      await page(p, A.cookie, 200);
    await page('/dashboard/overview', A.cookie, 307, /^\/$|localhost:\d+\/$/);
    await page('/mitra', A.cookie, 307);
    // Mitra pemilik
    for (const p of [
      '/mitra',
      '/mitra/pesanan',
      `/mitra/pesanan/${main.id}`,
      '/mitra/jadwal',
      '/mitra/usaha',
      '/mitra/tanya-jawab',
      '/mitra/ulasan',
      '/mitra/statistik',
      '/mitra/lainnya'
    ])
      await page(p, V1.cookie, 200);
    await page('/dashboard/bookings', V1.cookie, 307);
    await page(paths.citizenBooking(main.id), V1.cookie, 307, /\/masuk/);
    // Admin
    for (const p of [
      '/dashboard/overview',
      '/dashboard/bookings',
      `/dashboard/bookings/${main.id}`,
      '/dashboard/doors',
      '/dashboard/settings',
      '/dashboard/listings',
      '/dashboard/categories',
      '/dashboard/demand'
    ])
      await page(p, admin.cookie, 200);
  });
} finally {
  // ───── bersihkan ─────
  const ids = new Set(bookingIds);
  if (users.length)
    for (const r of await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(inArray(bookings.citizenId, users)))
      ids.add(r.id);
  if (phones.length)
    for (const r of await db
      .select({ id: bookingContacts.bookingId })
      .from(bookingContacts)
      .where(inArray(bookingContacts.phone, phones)))
      ids.add(r.id);
  const idList = [...ids];
  if (idList.length) {
    await db.delete(waMessages).where(inArray(waMessages.bookingId, idList));
    await db.delete(bookings).where(inArray(bookings.id, idList));
  }
  if (phones.length) {
    await db.delete(waMessages).where(inArray(waMessages.phone, phones));
    await db.delete(waOtps).where(inArray(waOtps.phone, phones));
  }
  // Log OTP warga yang dihapus akunnya dianonimkan (phone = 'dihapus'), bukan dihapus: buang milik run ini.
  await db
    .delete(waMessages)
    .where(
      and(
        eq(waMessages.phone, 'dihapus'),
        eq(waMessages.template, 'otp'),
        sql`${waMessages.createdAt} >= ${STARTED}`
      )
    );
  if (blockIds.length) await db.delete(slotBlocks).where(inArray(slotBlocks.id, blockIds));
  if (users.length) await db.delete(slotBlocks).where(inArray(slotBlocks.createdBy, users));
  for (const [id, owner] of ownerRestore)
    await db.update(listings).set({ ownerId: owner }).where(eq(listings.id, id));
  if (chatIds.length) {
    await db.delete(searchLogs).where(inArray(searchLogs.sessionId, chatIds));
    await db.delete(llmCalls).where(inArray(llmCalls.sessionId, chatIds));
    await db.delete(chatSessions).where(inArray(chatSessions.id, chatIds));
  }
  await db
    .delete(user)
    .where(
      or(
        users.length ? inArray(user.id, users) : undefined,
        like(user.email, `e2e-${RUN}-%@test.invalid`),
        phones.length ? inArray(user.phoneNumber, phones) : undefined
      )
    );
  const after = await countAll();
  console.log('Hitungan akhir:', JSON.stringify(after));
  const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
  console.log(
    diff.length ? `BEDA dengan awal: ${diff.join(', ')}` : 'bersih: semua hitungan sama dengan awal'
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\nBagian: ${results.length - failed.length}/${results.length} lulus; temuan: ${findings.length}`
);
for (const f of findings) console.log(`- TEMUAN ${f}`);
for (const r of failed) console.log(`- GAGAL ${r.name}: ${r.error?.split('\n')[0]}`);
console.log(failed.length || findings.length ? 'e2e.check: GAGAL' : 'e2e.check: OK');
process.exit(failed.length || findings.length ? 1 : 0);
