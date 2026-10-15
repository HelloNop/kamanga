// Klaim usaha (PRD 8.12 langkah 1 dan 4): mitra mengklaim listing yang diinput tim (owner_id kosong).
// Bukti kepemilikan: kode lewat WhatsApp ke nomor yang terdaftar pada usaha itu (notify.requestOtp/verifyOtp),
// atau tim memverifikasi dari antrean review admin. TANPA pemeriksaan login: hanya diimpor service.ts
// (mitra dan review) dan uji.
import { and, asc, count, desc, eq, ilike, isNull, ne } from 'drizzle-orm';
import { db } from '@/db';
import {
  categories,
  listingCategories,
  listingClaims,
  listings,
  locations,
  user
} from '@/db/schema';
import { notify } from '@/lib/engines/contracts';
import type { Fail } from './types';

const fail = (message: string): Fail => ({ ok: false, message });

/** Klaim menunggu per mitra, agar antrean tim tidak dibanjiri. */
export const MAX_PENDING_CLAIMS = 3;

export type ClaimableListing = {
  id: number;
  name: string;
  categoryName: string | null;
  district: string | null;
  /** WA usaha tersamar, mis. 0812•••••701. Kosong = tim yang memverifikasi. */
  waMasked: string | null;
};

export type MyClaim = {
  id: number;
  listingId: number;
  listingName: string;
  status: 'pending' | 'approved' | 'rejected';
  waMasked: string | null;
  createdAt: Date;
};

/** sent: kode terkirim ke WA usaha. none: usaha tanpa WA / kode tidak bisa dikirim (tim memverifikasi). */
export type ClaimCodeResult =
  | { ok: true; claimId: number; code: 'sent' | 'none' | 'rate_limited' }
  | Fail;

export type PendingClaim = {
  id: number;
  listingId: number;
  listingName: string;
  whatsapp: string | null;
  phone: string | null;
  claimant: { name: string; email: string };
  createdAt: string; // ISO
};

/** 6281200077701 → 0812•••••701 (cukup untuk dikenali pemiliknya, tidak membuka nomornya). */
export function maskWa(wa: string | null): string | null {
  if (!wa) return null;
  const local = `0${wa.replace(/^62/, '')}`;
  return `${local.slice(0, 4)}${'•'.repeat(Math.max(local.length - 7, 0))}${local.slice(-3)}`;
}

/** Hanya penyedia terbit tanpa pemilik yang bisa diklaim (draf tim tidak dibuka ke mitra; Tempat hanya informasi). */
const claimable = and(
  eq(listings.kind, 'provider'),
  eq(listings.status, 'published'),
  isNull(listings.ownerId)
);

export async function searchClaimable(q: string, limit = 20): Promise<ClaimableListing[]> {
  const term = q.trim().replace(/[%_\\]/g, '');
  if (term.length < 2) return [];
  const rows = await db
    .select({
      id: listings.id,
      name: listings.name,
      categoryName: categories.name,
      district: locations.name,
      whatsapp: listings.whatsapp
    })
    .from(listings)
    .leftJoin(
      listingCategories,
      and(eq(listingCategories.listingId, listings.id), eq(listingCategories.isPrimary, true))
    )
    .leftJoin(categories, eq(categories.id, listingCategories.categoryId))
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(claimable, ilike(listings.name, `%${term}%`)))
    .orderBy(listings.name)
    .limit(limit);
  return rows.map(({ whatsapp, ...r }) => ({ ...r, waMasked: maskWa(whatsapp) }));
}

export async function myClaims(userId: string): Promise<MyClaim[]> {
  const rows = await db
    .select({
      id: listingClaims.id,
      listingId: listingClaims.listingId,
      listingName: listings.name,
      status: listingClaims.status,
      whatsapp: listings.whatsapp,
      createdAt: listingClaims.createdAt
    })
    .from(listingClaims)
    .innerJoin(listings, eq(listings.id, listingClaims.listingId))
    .where(eq(listingClaims.claimantId, userId))
    .orderBy(desc(listingClaims.id))
    .limit(10);
  return rows.map(({ whatsapp, ...r }) => ({ ...r, waMasked: maskWa(whatsapp) }));
}

/**
 * Membuka klaim (atau memakai klaim menunggu yang sama) lalu mengirim kode ke WA usaha.
 * Dipanggil ulang = kirim ulang kode (batas kirim diatur mesin Notifikasi per nomor dan per ipHash).
 */
export async function requestClaimCode(
  userId: string,
  listingId: number,
  ipHash: string | null
): Promise<ClaimCodeResult> {
  const [l] = await db
    .select({ id: listings.id, whatsapp: listings.whatsapp })
    .from(listings)
    .where(and(eq(listings.id, listingId), claimable));
  if (!l) return fail('Usaha ini tidak bisa diklaim (sudah punya pemilik atau belum terbit)');

  let [claim] = await db
    .select({ id: listingClaims.id })
    .from(listingClaims)
    .where(
      and(
        eq(listingClaims.listingId, listingId),
        eq(listingClaims.claimantId, userId),
        eq(listingClaims.status, 'pending')
      )
    );
  if (!claim) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(listingClaims)
      .where(and(eq(listingClaims.claimantId, userId), eq(listingClaims.status, 'pending')));
    if (n >= MAX_PENDING_CLAIMS)
      return fail(`Maksimal ${MAX_PENDING_CLAIMS} klaim menunggu. Selesaikan klaim lain dulu.`);
    [claim] = await db
      .insert(listingClaims)
      .values({ listingId, claimantId: userId })
      .returning({ id: listingClaims.id });
  }

  if (!l.whatsapp) return { ok: true, claimId: claim.id, code: 'none' };
  const otp = await notify.requestOtp(l.whatsapp, ipHash);
  return {
    ok: true,
    claimId: claim.id,
    code: otp.ok ? 'sent' : otp.reason === 'rate_limited' ? 'rate_limited' : 'none'
  };
}

/** Mitra memasukkan kode dari WA usaha. Benar = klaim disetujui otomatis. */
export async function verifyClaimCode(
  userId: string,
  claimId: number,
  code: string
): Promise<{ ok: true; listingId: number } | Fail> {
  const [c] = await db
    .select({ listingId: listingClaims.listingId, whatsapp: listings.whatsapp })
    .from(listingClaims)
    .innerJoin(listings, eq(listings.id, listingClaims.listingId))
    .where(
      and(
        eq(listingClaims.id, claimId),
        eq(listingClaims.claimantId, userId),
        eq(listingClaims.status, 'pending')
      )
    );
  if (!c) return fail('Klaim tidak ditemukan atau sudah diputuskan');
  if (!c.whatsapp)
    return fail('Usaha ini tidak punya nomor WhatsApp. Tim Kamanga yang memverifikasi.');
  if (!/^\d{6}$/.test(code.trim())) return fail('Kode terdiri dari 6 angka');
  const v = await notify.verifyOtp(c.whatsapp, code);
  if (!v.ok)
    return fail(
      v.reason === 'wrong'
        ? 'Kode salah'
        : v.reason === 'too_many'
          ? 'Terlalu banyak percobaan. Minta kode baru.'
          : 'Kode sudah tidak berlaku. Minta kode baru.'
    );
  return approveClaim(claimId, null, 'Kode WhatsApp usaha terverifikasi');
}

/**
 * Setujui klaim: owner_id diisi bila masih kosong (dijamin di UPDATE yang sama, jadi dua klaim serentak
 * tidak bisa sama-sama menang), klaim lain yang menunggu untuk usaha itu ditolak.
 */
export async function approveClaim(
  claimId: number,
  reviewerId: string | null,
  evidence: string
): Promise<{ ok: true; listingId: number } | Fail> {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select({ listingId: listingClaims.listingId, claimantId: listingClaims.claimantId })
      .from(listingClaims)
      .where(and(eq(listingClaims.id, claimId), eq(listingClaims.status, 'pending')))
      .for('update');
    if (!c) return fail('Klaim ini sudah diputuskan. Muat ulang halaman.');
    const [l] = await tx
      .update(listings)
      .set({ ownerId: c.claimantId })
      .where(and(eq(listings.id, c.listingId), isNull(listings.ownerId)))
      .returning({ id: listings.id });
    if (!l) return fail('Usaha ini sudah punya pemilik');
    const now = new Date();
    await tx
      .update(listingClaims)
      .set({ status: 'approved', reviewedBy: reviewerId, reviewedAt: now, evidence })
      .where(eq(listingClaims.id, claimId));
    await tx
      .update(listingClaims)
      .set({ status: 'rejected', reviewedBy: reviewerId, reviewedAt: now })
      .where(
        and(
          eq(listingClaims.listingId, c.listingId),
          eq(listingClaims.status, 'pending'),
          ne(listingClaims.id, claimId)
        )
      );
    return { ok: true as const, listingId: c.listingId };
  });
}

export async function rejectClaim(
  claimId: number,
  reviewerId: string
): Promise<{ ok: true } | Fail> {
  const [c] = await db
    .update(listingClaims)
    .set({ status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date() })
    .where(and(eq(listingClaims.id, claimId), eq(listingClaims.status, 'pending')))
    .returning({ id: listingClaims.id });
  return c ? { ok: true } : fail('Klaim ini sudah diputuskan. Muat ulang halaman.');
}

// ───── Antrean tim ─────

export async function countPendingClaims(): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(listingClaims)
    .where(eq(listingClaims.status, 'pending'));
  return n;
}

/** Klaim menunggu, yang paling lama di atas. Tim melihat nomor usaha lengkap untuk menghubunginya. */
export async function pendingClaims(limit = 30): Promise<PendingClaim[]> {
  const rows = await db
    .select({
      id: listingClaims.id,
      listingId: listings.id,
      listingName: listings.name,
      whatsapp: listings.whatsapp,
      phone: listings.phone,
      claimantName: user.name,
      claimantEmail: user.email,
      createdAt: listingClaims.createdAt
    })
    .from(listingClaims)
    .innerJoin(listings, eq(listings.id, listingClaims.listingId))
    .innerJoin(user, eq(user.id, listingClaims.claimantId))
    .where(eq(listingClaims.status, 'pending'))
    .orderBy(asc(listingClaims.createdAt))
    .limit(limit);
  return rows.map(({ claimantName, claimantEmail, createdAt, ...r }) => ({
    ...r,
    claimant: { name: claimantName, email: claimantEmail },
    createdAt: createdAt.toISOString()
  }));
}
