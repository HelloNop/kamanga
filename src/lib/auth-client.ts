'use client';

import { adminClient, phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Warga: kode OTP diminta lewat POST /api/wa/otp, lalu `authClient.phoneNumber.verify({ phoneNumber, code })`
// membuat akun (bila belum ada) dan sesi.
export const authClient = createAuthClient({ plugins: [adminClient(), phoneNumberClient()] });
