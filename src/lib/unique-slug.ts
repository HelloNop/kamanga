import { slugify } from '@/lib/slug';

/** Slug dari `source`; bila sudah dipakai tambahkan -2, -3, ... `isTaken` memeriksa database. */
export async function uniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>,
  fallback = 'item'
) {
  const base = slugify(source) || fallback;
  let candidate = base;
  for (let n = 2; await isTaken(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}
