import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins';
import { db } from '@/db';

// Dua peran: `admin` (tim Kamanga) dan `vendor` (pendaftar sendiri).
// Siapa pun yang mendaftar otomatis menjadi vendor; peran tidak bisa diisi dari formulir.
// Peran admin hanya diberikan lewat skrip `auth:create-admin` atau oleh admin lain.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Membuka server lokal lewat terowongan (ngrok, dll.): isi DEV_PUBLIC_URL dengan alamat persisnya.
  // Tanpa ini, masuk dari alamat lain ditolak ("Invalid origin"). Jangan memakai wildcard.
  trustedOrigins: process.env.DEV_PUBLIC_URL ? [process.env.DEV_PUBLIC_URL] : [],
  // TODO(email): aktifkan verifikasi email dan reset kata sandi setelah ada layanan pengirim email.
  plugins: [
    admin({ defaultRole: 'vendor', adminRoles: ['admin'] }),
    nextCookies() // harus terakhir
  ]
});

export type Role = 'admin' | 'vendor';
