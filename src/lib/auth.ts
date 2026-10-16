import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin, phoneNumber } from 'better-auth/plugins';
import { db } from '@/db';
import { notify } from '@/lib/engines/contracts';

const PHONE_VERIFY_PATH = '/phone-number/verify';

// Tiga peran: `admin` (tim Kamanga), `vendor` (mitra, daftar dengan email + sandi), dan `citizen`
// (warga, masuk dengan nomor WhatsApp + OTP). Peran tidak bisa diisi dari formulir.
// Peran admin hanya diberikan lewat skrip `auth:create-admin` atau oleh admin lain.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  // Membuka server lokal lewat terowongan (ngrok, dll.): isi DEV_PUBLIC_URL dengan alamat persisnya.
  // Tanpa ini, masuk dari alamat lain ditolak ("Invalid origin"). Jangan memakai wildcard.
  trustedOrigins: process.env.DEV_PUBLIC_URL ? [process.env.DEV_PUBLIC_URL] : [],
  // Kode OTP dibuat dan dikirim Mesin Notifikasi (POST /api/wa/otp) yang hanya menyimpan hash-nya.
  // Endpoint bawaan plugin yang menyimpan kode polos atau memakai sandi dimatikan.
  disabledPaths: [
    '/phone-number/send-otp',
    '/sign-in/phone-number',
    '/phone-number/request-password-reset',
    '/phone-number/reset-password'
  ],
  user: {
    additionalFields: {
      // Waktu warga menyetujui kebijakan privasi (UU PDP). Diisi server, bukan dari formulir.
      privacyConsentAt: { type: 'date', required: false, input: false }
    }
  },
  // Nomor WA hanya boleh tercatat lewat verifikasi OTP (/phone-number/verify). Isian phoneNumber dari plugin
  // bisa diisi lewat formulir lain (daftar email, ubah profil); tanpa penjagaan ini penyusup bisa memasang nomor
  // orang lain lalu mengambil alih akun warga pemilik nomor itu saat ia masuk dengan OTP.
  databaseHooks: {
    user: {
      create: {
        before: async (u, ctx) =>
          ctx?.path === PHONE_VERIFY_PATH && (u as { phoneNumber?: string }).phoneNumber
            ? { data: { ...u, role: 'citizen' } } // akun dari verifikasi nomor WA = warga
            : { data: { ...u, phoneNumber: null, phoneNumberVerified: false } }
      },
      update: {
        before: async (data, ctx) => {
          const d = data as { phoneNumber?: unknown; phoneNumberVerified?: unknown };
          const touchesPhone = d.phoneNumber !== undefined || d.phoneNumberVerified !== undefined;
          return touchesPhone && ctx?.path !== PHONE_VERIFY_PATH ? false : undefined;
        }
      }
    }
  },
  // TODO(email): aktifkan verifikasi email dan reset kata sandi setelah ada layanan pengirim email.
  plugins: [
    admin({ defaultRole: 'vendor', adminRoles: ['admin'] }),
    phoneNumber({
      phoneNumberValidator: (p) => /^62\d{8,13}$/.test(p),
      sendOTP: () => {
        throw new Error('Kirim OTP lewat POST /api/wa/otp');
      },
      verifyOTP: async ({ phoneNumber: phone, code }) => (await notify.verifyOtp(phone, code)).ok,
      signUpOnVerification: {
        // Email wajib di Better Auth; warga tidak memakainya. Domain .invalid tidak pernah bisa dikirimi.
        getTempEmail: (phone) => `${phone}@warga.kamanga.invalid`,
        getTempName: () => 'Warga'
      }
    }),
    nextCookies() // harus terakhir
  ]
});

export type Role = 'admin' | 'vendor' | 'citizen';
