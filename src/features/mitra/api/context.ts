import { cookies } from 'next/headers';
import { cache } from 'react';
import { requireVendor } from '@/lib/session';
import { ownedListings } from './repository';

/** Usaha yang sedang dipilih mitra (bila punya lebih dari satu). Isinya hanya id listing. */
export const ACTIVE_LISTING_COOKIE = 'kmg_mitra_usaha';

/**
 * Untuk layout dan halaman /mitra (server). Memanggil requireVendor(), lalu mengambil usaha milik mitra dan
 * usaha yang dipilih (cookie; bawaan yang pertama). Cookie dari usaha orang lain diabaikan.
 */
export const mitraContext = cache(async () => {
  const session = await requireVendor();
  const list = await ownedListings(session.user.id);
  const wanted = Number((await cookies()).get(ACTIVE_LISTING_COOKIE)?.value);
  const active = list.find((l) => l.id === wanted) ?? list[0] ?? null;
  return { user: session.user, listings: list, active };
});
