// Membuat (atau menaikkan) akun admin dari ADMIN_EMAIL dan ADMIN_PASSWORD di .env.local.
// Jalankan: bun run auth:create-admin
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from './index';
import { user } from './schema';

const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error('Isi ADMIN_EMAIL dan ADMIN_PASSWORD di .env.local dulu.');
  process.exit(1);
}

const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
if (!existing) await auth.api.signUpEmail({ body: { email, password, name: 'Admin Kamanga' } });
await db.update(user).set({ role: 'admin' }).where(eq(user.email, email));

console.log(`${existing ? 'Akun sudah ada' : 'Akun dibuat'}: ${email} -> peran admin`);
process.exit(0);
