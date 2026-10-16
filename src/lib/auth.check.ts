// Pemeriksaan keamanan akun warga: bun run check:auth
// Nomor WA hanya boleh tercatat lewat verifikasi OTP; daftar email / ubah profil tidak bisa memasang nomor
// orang lain (temuan K1 di docs/laporan-uji.md).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { eq, like, or } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { notify } from '@/lib/engines/contracts';

const VICTIM = '6289977700011';
const pass = randomBytes(18).toString('base64url');
const clean = () =>
  db
    .delete(user)
    .where(or(like(user.email, 'auth-check-%@test.invalid'), eq(user.phoneNumber, VICTIM)));

const realVerify = notify.verifyOtp;
try {
  await clean();

  // 1. Daftar email dengan nomor orang lain: nomor dibuang, peran tetap mitra.
  await auth.api.signUpEmail({
    body: {
      email: 'auth-check-a@test.invalid',
      password: pass,
      name: 'Penyusup',
      phoneNumber: VICTIM
    } as never
  });
  const [a] = await db.select().from(user).where(eq(user.email, 'auth-check-a@test.invalid'));
  assert.equal(a.phoneNumber, null);
  assert.equal(a.role, 'vendor');
  console.log('1. daftar email tidak bisa memasang nomor WA: OK');

  // 2. Ubah profil dengan nomor orang lain: ditolak, nomor tetap kosong.
  const signIn = await auth.api.signInEmail({
    body: { email: 'auth-check-a@test.invalid', password: pass },
    asResponse: true
  });
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  await auth.api
    .updateUser({ body: { phoneNumber: VICTIM } as never, headers: new Headers({ cookie }) })
    .catch(() => null);
  const [a2] = await db.select().from(user).where(eq(user.email, 'auth-check-a@test.invalid'));
  assert.equal(a2.phoneNumber, null);
  console.log('2. ubah profil tidak bisa memasang nomor WA: OK');

  // 3. Pemilik nomor masuk dengan OTP: akun warga BARU miliknya sendiri, bukan akun penyusup.
  notify.verifyOtp = (async () => ({ ok: true })) as typeof notify.verifyOtp;
  await auth.api.verifyPhoneNumber({ body: { phoneNumber: VICTIM, code: '000000' } });
  const [v] = await db.select().from(user).where(eq(user.phoneNumber, VICTIM));
  assert.ok(v && v.id !== a.id);
  assert.equal(v.role, 'citizen');
  assert.equal(v.phoneNumberVerified, true);
  console.log('3. OTP membuat akun warga milik pemilik nomor: OK');

  // 4. Kode OTP salah: tidak masuk.
  notify.verifyOtp = (async () => ({ ok: false, reason: 'wrong' })) as typeof notify.verifyOtp;
  const bad = await auth.api
    .verifyPhoneNumber({ body: { phoneNumber: VICTIM, code: '111111' } })
    .then(() => 'ok')
    .catch(() => 'ditolak');
  assert.equal(bad, 'ditolak');
  console.log('4. kode OTP salah ditolak: OK');
  console.log('auth.check: OK');
} finally {
  notify.verifyOtp = realVerify;
  await clean();
  process.exit(process.exitCode ?? 0);
}
