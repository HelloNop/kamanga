'use server';

// Server action warga. Server Action adalah endpoint publik, jadi SETIAP fungsi memeriksa sesi warga
// (peran citizen) lebih dulu dan mengembalikan galat, bukan redirect.
import { z } from 'zod';
import { parseAttributeSchema } from '@/features/listings/lib/format';
import {
  booking,
  type CreateBookingFail,
  location,
  paths,
  type RulesSnapshot
} from '@/lib/engines/contracts';
import { getSession } from '@/lib/session';
import { buildRules } from '../lib/format';
import {
  activeBookingIds,
  deleteCitizenData,
  districtOf,
  getBookingTarget,
  getCitizenProfile,
  insertSavedAddress,
  removeSavedAddress,
  setCitizenProfile
} from './repository';
import type { ActionResult } from './types';
import { locSchema, whereOf } from './where';

async function citizen() {
  const s = await getSession();
  return s?.user.role === 'citizen' ? s : null;
}
const NEED_LOGIN = { ok: false as const, error: 'Masuk dulu dengan nomor WhatsApp.' };

// ───────────────────────────── Akun ─────────────────────────────

/** Dipanggil halaman masuk setelah OTP benar: akun baru perlu nama panggilan + persetujuan privasi. */
export async function citizenStatus(): Promise<ActionResult<{ needsProfile: boolean }>> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  const p = await getCitizenProfile(s.user.id);
  return { ok: true, needsProfile: !p?.privacyConsentAt };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 huruf.').max(40, 'Nama maksimal 40 huruf.'),
  consent: z.literal(true, 'Setujui kebijakan privasi dulu.')
});

/** Nama panggilan + waktu persetujuan privasi (UU PDP). */
export async function completeProfile(raw: unknown): Promise<ActionResult> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await setCitizenProfile(s.user.id, parsed.data.name);
  return { ok: true };
}

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Isi nama alamat, mis. Rumah.').max(30),
  address: z.string().trim().min(5, 'Tulis alamat lengkapnya.').max(300),
  loc: locSchema.refine((l) => l.source !== 'saved')
});

/**
 * Simpan alamat. Titik perangkat HANYA disimpan di sini, atas pilihan warga (PRD 8.15).
 * Alamat dari nama daerah disimpan tanpa titik.
 */
export async function addSavedAddress(raw: unknown): Promise<ActionResult> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { label, address, loc } = parsed.data;
  let point: { lat: number; lng: number } | null = null;
  let locationId: number | null = null;
  if (loc.source === 'device') {
    const r = await location.resolvePoint(loc.point);
    if (!r) return { ok: false, error: 'Titik ini tidak dikenali. Ketik nama daerahnya saja.' };
    point = loc.point;
    locationId = (r.village ?? r.district ?? r.city)?.id ?? null;
  } else if (loc.source === 'place') locationId = loc.regionId;
  await insertSavedAddress({
    userId: s.user.id,
    label,
    address,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    locationId
  });
  return { ok: true };
}

export async function deleteSavedAddress(id: number): Promise<ActionResult> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  if (!Number.isInteger(id)) return { ok: false, error: 'Alamat tidak ditemukan.' };
  await removeSavedAddress(s.user.id, id);
  return { ok: true };
}

/** Hapus akun dan data pribadi (PRD 8.7). Pesanan aktif dibatalkan lebih dulu agar penyedia tahu. */
export async function deleteAccount(confirm: string): Promise<ActionResult> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  if (confirm !== 'HAPUS') return { ok: false, error: 'Ketik HAPUS untuk memastikan.' };
  for (const id of await activeBookingIds(s.user.id))
    await booking.cancelBooking(id, { kind: 'citizen', userId: s.user.id }, 'Akun warga dihapus');
  await deleteCitizenData(s.user.id);
  return { ok: true };
}

// ───────────────────────────── Pesanan ─────────────────────────────

const FAIL_TEXT: Record<CreateBookingFail, string> = {
  listing_unavailable: 'Penyedia ini belum bisa dipesan lewat Kamanga.',
  not_verified: 'Penyedia ini belum diverifikasi tim Kamanga, jadi belum bisa dipesan.',
  no_whatsapp: 'Penyedia ini belum punya nomor WhatsApp, jadi belum bisa dipesan.',
  needs_slot: 'Pilih jadwal dulu.',
  needs_request: 'Lengkapi keluhan, tanggal, dan bagian hari.',
  unit_inactive: 'Unit ini sedang tidak dipakai. Pilih jadwal lain.',
  past: 'Jadwal ini sudah lewat. Pilih jadwal lain.',
  closed: 'Penyedia tutup pada jadwal itu. Pilih jadwal lain.',
  misaligned: 'Jadwal tidak pas dengan pembagian slot penyedia. Pilih dari daftar.',
  too_short: 'Lama pemesanan kurang dari durasi minimal. Pilih lebih lama.',
  blocked: 'Jadwal ini sudah terisi di luar Kamanga. Pilih jadwal lain.',
  taken: 'Jadwal ini baru saja diambil orang lain. Pilih jadwal lain.',
  no_seats: 'Kursi tidak cukup. Kurangi jumlah penumpang atau pilih keberangkatan lain.'
};
/** Kegagalan yang bisa diatasi dengan memilih jadwal lain. */
const RETRY: CreateBookingFail[] = [
  'needs_slot',
  'unit_inactive',
  'past',
  'closed',
  'misaligned',
  'blocked',
  'taken',
  'no_seats'
];

const iso = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const bookingSchema = z.object({
  slug: z.string().min(1).max(200),
  slot: z
    .object({
      unitId: z.number().int().positive(),
      startsAt: iso,
      endsAt: iso,
      seats: z.number().int().min(1).max(50)
    })
    .nullable(),
  request: z
    .object({
      problem: z.string().trim().min(3, 'Ceritakan kebutuhanmu dulu.').max(500),
      preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pilih tanggal.'),
      period: z.enum(['pagi', 'siang', 'sore', 'malam'], 'Pilih bagian hari.')
    })
    .nullable(),
  loc: locSchema.nullable(),
  address: z.string().trim().max(300).default(''),
  note: z.string().trim().max(200).default(''),
  racket: z.boolean().default(false),
  rules: z.record(z.string(), z.unknown())
});

/** Buat pesanan (PRD 8.5). Tautan Terima/Tolak penyedia TIDAK pernah dikembalikan ke warga (rencana keputusan 8). */
export async function createBookingAction(
  raw: unknown
): Promise<ActionResult<{ href: string }> & { retryHref?: string }> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  const profile = await getCitizenProfile(s.user.id);
  if (!profile?.privacyConsentAt || !profile.phone)
    return { ok: false, error: 'Lengkapi akunmu dulu (nama dan persetujuan privasi).' };
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const q = parsed.data;

  const t = await getBookingTarget(q.slug);
  if (!t?.bookable || !t.category) return { ok: false, error: FAIL_TEXT.listing_unavailable };
  const kind = t.category.scheduleKind;
  const retryHref = paths.bookingStart(t.listing.slug);

  // Aturan yang disetujui harus sama dengan aturan penyedia saat ini.
  const rules = buildRules(parseAttributeSchema(t.category.attributeSchema), t.listing.attributes);
  if (JSON.stringify(rules.snapshot) !== JSON.stringify(q.rules as RulesSnapshot))
    return {
      ok: false,
      error: 'Aturan penyedia baru saja berubah. Muat ulang halaman dan baca lagi.'
    };

  // Lokasi → kecamatan (yang terlihat penyedia sebelum menerima). Titik perangkat tidak disimpan;
  // titik alamat tersimpan boleh ikut karena warga sendiri yang menyimpannya.
  const where = await whereOf(q.loc);
  if (where.error) return { ok: false, error: where.error };
  let districtId: number | null = null;
  if (q.loc?.source === 'device' && where.origin)
    districtId = (await location.resolvePoint(where.origin))?.district?.id ?? null;
  else if (where.regionId) districtId = await districtOf(where.regionId);
  else if (where.saved) districtId = await districtOf(where.saved.locationId);

  const needsAddress = kind !== 'slot';
  const address = q.address || where.saved?.address || '';
  if (needsAddress && address.length < 5)
    return { ok: false, error: 'Tulis alamat lengkap supaya penyedia bisa datang atau menjemput.' };
  if (needsAddress && !districtId) return { ok: false, error: 'Pilih lokasi (kecamatan) dulu.' };

  const racketOffered =
    t.listing.attributes.racket_included === false &&
    typeof t.listing.attributes.racket_price === 'number';
  const details: Record<string, unknown> = {};
  if (racketOffered && q.racket) details['sewa raket'] = 'ya';

  const res = await booking.createBooking({
    citizenId: s.user.id,
    listingId: t.listing.id,
    categoryId: t.category.id,
    slot: kind === 'none' || !q.slot ? undefined : q.slot,
    request: kind === 'none' && q.request ? q.request : undefined,
    seats: q.slot?.seats,
    districtId,
    contact: {
      name: profile.name,
      phone: profile.phone,
      address: needsAddress ? address : null,
      point: needsAddress ? (where.saved?.point ?? null) : null,
      note: q.note || null
    },
    details,
    rulesAccepted: rules.snapshot
  });
  if (!res.ok)
    return {
      ok: false,
      error: FAIL_TEXT[res.reason] ?? 'Pesanan gagal dikirim.',
      retryHref: RETRY.includes(res.reason) ? retryHref : undefined
    };
  return { ok: true, href: paths.citizenBooking(res.bookingId) };
}

export async function cancelBookingAction(
  id: number,
  reason: string
): Promise<ActionResult & { tooLate?: boolean }> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  if (!Number.isInteger(id)) return { ok: false, error: 'Pesanan tidak ditemukan.' };
  const r = await booking.cancelBooking(
    id,
    { kind: 'citizen', userId: s.user.id },
    String(reason ?? '').slice(0, 200)
  );
  if (r.ok) return { ok: true };
  if (r.reason === 'too_late')
    return { ok: false, tooLate: true, error: 'Batas waktu pembatalan sudah lewat.' };
  return {
    ok: false,
    error:
      r.reason === 'not_found'
        ? 'Pesanan tidak ditemukan.'
        : 'Pesanan ini tidak bisa dibatalkan lagi.'
  };
}

const reviewSchema = z.object({
  satisfied: z.boolean('Pilih Puas atau Kurang puas.'),
  stars: z.number().int().min(1).max(5).nullable(),
  comment: z.string().trim().max(500).nullable()
});

export async function submitReviewAction(id: number, raw: unknown): Promise<ActionResult> {
  const s = await citizen();
  if (!s) return NEED_LOGIN;
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const r = await booking.submitReview(id, s.user.id, parsed.data);
  if (r.ok) return { ok: true };
  return {
    ok: false,
    error:
      r.reason === 'already_reviewed'
        ? 'Kamu sudah memberi ulasan untuk pesanan ini.'
        : r.reason === 'not_completed'
          ? 'Ulasan bisa diberikan setelah pesanan selesai.'
          : 'Pesanan tidak ditemukan.'
  };
}
