// Query Drizzle untuk halaman warga. Tanpa cek login: pemanggil (halaman / service) yang memeriksa sesi.
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { user } from '@/db/auth-schema';
import {
  bookingContacts,
  bookings,
  categories,
  doors,
  listingCategories,
  listingDailyStats,
  listingQa,
  listings,
  locations,
  reviews,
  savedAddresses,
  units,
  waMessages,
  waOtps
} from '@/db/schema';
import { jakartaDate } from '@/lib/engines/time';
import type { ScheduleKind } from '@/lib/engines/contracts';

const BOOKABLE_KINDS: ScheduleKind[] = ['slot', 'seat', 'none'];

/** Pintu di beranda: aktif dan "segera". Tersembunyi tidak ditampilkan. Urutan dari admin. */
export function getHomeDoors() {
  return db
    .select({
      slug: doors.slug,
      name: doors.name,
      icon: doors.icon,
      description: doors.description,
      rotatingText: doors.rotatingText,
      status: doors.status
    })
    .from(doors)
    .where(inArray(doors.status, ['active', 'soon']))
    .orderBy(asc(doors.sortOrder), asc(doors.name));
}

/** Pintu + kategori aktifnya (pintu utama = categories.door_id). */
export async function getDoor(slug: string) {
  const [door] = await db.select().from(doors).where(eq(doors.slug, slug)).limit(1);
  if (!door) return null;
  const cats = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      scheduleKind: categories.scheduleKind
    })
    .from(categories)
    .where(and(eq(categories.doorId, door.id), eq(categories.isActive, true)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return { door, categories: cats };
}

/** Kategori aktif beserta status pintunya (untuk memeriksa masukan pencarian). */
export async function getCategoryForSearch(id: number) {
  const [c] = await db
    .select({
      id: categories.id,
      name: categories.name,
      scheduleKind: categories.scheduleKind,
      doorStatus: doors.status
    })
    .from(categories)
    .innerJoin(doors, eq(doors.id, categories.doorId))
    .where(and(eq(categories.id, id), eq(categories.isActive, true)));
  return c ?? null;
}

export async function unitNames(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await db
    .select({ id: units.id, name: units.name })
    .from(units)
    .where(inArray(units.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Kota tujuan travel yang benar-benar dilayani unit aktif listing terbit di kategori ini. */
export async function getTravelDestinations(categoryId: number) {
  return db
    .selectDistinct({ id: locations.id, name: locations.name })
    .from(units)
    .innerJoin(listings, eq(listings.id, units.listingId))
    .innerJoin(
      listingCategories,
      and(
        eq(listingCategories.listingId, listings.id),
        eq(listingCategories.categoryId, categoryId)
      )
    )
    .innerJoin(locations, eq(locations.id, units.destinationLocationId))
    .where(and(eq(units.isActive, true), eq(listings.status, 'published')))
    .orderBy(asc(locations.name));
}

/**
 * Listing terbit + kategori yang dipakai untuk memesan: kategori utama bila punya pintu, selain itu kategori
 * pertama yang punya pintu. bookable mengikuti aturan createBooking (rencana-tahap1 keputusan 14).
 */
export async function getBookingTarget(slug: string) {
  const [l] = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      name: listings.name,
      kind: listings.kind,
      verification: listings.verificationLevel,
      whatsapp: listings.whatsapp,
      attributes: listings.attributes,
      locationName: locations.name
    })
    .from(listings)
    .leftJoin(locations, eq(locations.id, listings.locationId))
    .where(and(eq(listings.slug, slug), eq(listings.status, 'published')))
    .limit(1);
  if (!l) return null;
  const cats = await db
    .select({
      id: categories.id,
      name: categories.name,
      scheduleKind: categories.scheduleKind,
      attributeSchema: categories.attributeSchema,
      isActive: categories.isActive,
      isPrimary: listingCategories.isPrimary,
      doorName: doors.name,
      doorSlug: doors.slug,
      doorStatus: doors.status
    })
    .from(listingCategories)
    .innerJoin(categories, eq(categories.id, listingCategories.categoryId))
    .innerJoin(doors, eq(doors.id, categories.doorId))
    .where(eq(listingCategories.listingId, l.id))
    .orderBy(desc(listingCategories.isPrimary), asc(categories.id));
  const category = cats[0] ?? null;
  const unitRows = await db
    .select({
      id: units.id,
      name: units.name,
      capacity: units.capacity
    })
    .from(units)
    .where(and(eq(units.listingId, l.id), eq(units.isActive, true)))
    .orderBy(asc(units.sortOrder), asc(units.id));
  const bookable =
    !!category &&
    l.kind === 'provider' &&
    category.isActive &&
    category.doorStatus === 'active' &&
    BOOKABLE_KINDS.includes(category.scheduleKind) &&
    l.verification !== 'unverified' &&
    !!l.whatsapp;
  return { listing: l, category, units: unitRows, bookable };
}

/** Kecamatan dari sebuah wilayah: dirinya bila kecamatan, induknya bila kelurahan/patokan. */
export async function districtOf(locationId: number | null | undefined) {
  if (!locationId) return null;
  const rows = (
    await db.execute(sql`
      select case when l.level = 'district' then l.id when p.level = 'district' then p.id end as id
      from locations l left join locations p on p.id = l.parent_id where l.id = ${locationId}`)
  ).rows as { id: number | null }[];
  return rows[0]?.id == null ? null : Number(rows[0].id);
}

// ───────────────────────────── Alamat tersimpan ─────────────────────────────

export function listSavedAddresses(userId: string) {
  return db
    .select({
      id: savedAddresses.id,
      label: savedAddresses.label,
      address: savedAddresses.address,
      locationId: savedAddresses.locationId,
      locationName: locations.name,
      hasPoint: sql<boolean>`${savedAddresses.lat} is not null`
    })
    .from(savedAddresses)
    .leftJoin(locations, eq(locations.id, savedAddresses.locationId))
    .where(eq(savedAddresses.userId, userId))
    .orderBy(asc(savedAddresses.createdAt));
}

export async function getSavedAddress(userId: string, id: number) {
  const [a] = await db
    .select()
    .from(savedAddresses)
    .where(and(eq(savedAddresses.id, id), eq(savedAddresses.userId, userId)));
  return a ?? null;
}

export function insertSavedAddress(v: typeof savedAddresses.$inferInsert) {
  return db.insert(savedAddresses).values(v);
}

export function removeSavedAddress(userId: string, id: number) {
  return db
    .delete(savedAddresses)
    .where(and(eq(savedAddresses.id, id), eq(savedAddresses.userId, userId)));
}

// ───────────────────────────── Akun warga ─────────────────────────────

/** Nama panggilan + waktu persetujuan privasi (hanya diisi sekali, saat pertama setuju). */
export function setCitizenProfile(userId: string, name: string) {
  return db
    .update(user)
    .set({ name, privacyConsentAt: sql`coalesce(${user.privacyConsentAt}, now())` })
    .where(eq(user.id, userId));
}

export async function getCitizenProfile(userId: string) {
  const [u] = await db
    .select({
      name: user.name,
      phone: user.phoneNumber,
      role: user.role,
      privacyConsentAt: user.privacyConsentAt
    })
    .from(user)
    .where(eq(user.id, userId));
  return u ?? null;
}

/**
 * Hapus akun warga dan data pribadinya (PRD 8.7, UU PDP). Pesanan dan ulasan tetap ada secara anonim
 * (FK set null); alamat tersimpan dan sesi ikut terhapus (FK cascade). Kontak di pesanan, kode OTP, dan
 * nomor di log pesan WA miliknya juga dihapus. Pesanan aktif dibatalkan pemanggil lebih dulu.
 */
export async function deleteCitizenData(userId: string) {
  await db.transaction(async (tx) => {
    const [u] = await tx
      .select({ phone: user.phoneNumber, role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .for('update');
    if (!u || u.role !== 'citizen') throw new Error('Bukan akun warga');
    const mine = tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.citizenId, userId));
    await tx.delete(bookingContacts).where(inArray(bookingContacts.bookingId, mine));
    if (u.phone) {
      await tx.delete(waOtps).where(eq(waOtps.phone, u.phone));
      await tx
        .update(waMessages)
        .set({ phone: 'dihapus' })
        .where(
          and(
            eq(waMessages.phone, u.phone),
            or(eq(waMessages.template, 'otp'), inArray(waMessages.bookingId, mine))
          )
        );
    }
    await tx.delete(user).where(eq(user.id, userId));
  });
}

// ───────────────────────────── Profil listing ─────────────────────────────

/** Tanya jawab yang sudah terjawab dan ulasan terbaru (tanpa identitas warga). */
export async function getListingExtras(listingId: number) {
  const [qa, revs] = await Promise.all([
    db
      .select({ id: listingQa.id, question: listingQa.question, answer: listingQa.answer })
      .from(listingQa)
      .where(and(eq(listingQa.listingId, listingId), isNotNull(listingQa.answer)))
      .orderBy(asc(listingQa.sortOrder), asc(listingQa.id)),
    db
      .select({
        id: reviews.id,
        satisfied: reviews.satisfied,
        stars: reviews.stars,
        comment: reviews.comment,
        createdAt: reviews.createdAt
      })
      .from(reviews)
      .where(eq(reviews.listingId, listingId))
      .orderBy(desc(reviews.createdAt))
      .limit(20)
  ]);
  return { qa, reviews: revs };
}

/** Kunjungan profil: naik satu per tayangan per hari WIB. Tanpa data pribadi. */
export function countListingView(listingId: number) {
  return db
    .insert(listingDailyStats)
    .values({ listingId, day: jakartaDate(new Date()), views: 1 })
    .onConflictDoUpdate({
      target: [listingDailyStats.listingId, listingDailyStats.day],
      set: { views: sql`${listingDailyStats.views} + 1` }
    });
}

/** Pesanan aktif warga (untuk dibatalkan sebelum akun dihapus). */
export async function activeBookingIds(userId: string) {
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.citizenId, userId), inArray(bookings.status, ['sent', 'accepted'])));
  return rows.map((r) => r.id);
}
