// Pembantu skrip seed: kelompok kategori dulu berupa daftar tetap di kode, sekarang tabel yang bisa
// ditambah admin. seed-reference memetakan kelompok lama ke nama kelompok baru.
import { eq } from 'drizzle-orm';
import { db } from './index';
import { categoryGroups } from './schema';

export type LegacyGroup = 'service' | 'place' | 'attraction' | 'freelance' | 'product';

const LEGACY_NAMES: Record<LegacyGroup, string> = {
  service: 'Jasa',
  place: 'Tempat',
  attraction: 'Wisata',
  freelance: 'Freelance',
  product: 'Produk'
};

/** Id kelompok untuk nilai kelompok lama; dibuat bila belum ada. */
export async function legacyGroupId(g: LegacyGroup): Promise<number> {
  const name = LEGACY_NAMES[g];
  const slug = name.toLowerCase();
  const [hit] = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(eq(categoryGroups.slug, slug))
    .limit(1);
  if (hit) return hit.id;
  const [row] = await db
    .insert(categoryGroups)
    .values({ slug, name })
    .returning({ id: categoryGroups.id });
  return row.id;
}

/** Aturan chatbot yang dulu melekat pada kelompok bawaan. */
export const legacyFlags = (g: LegacyGroup) => ({
  needsLocation: g === 'service' || g === 'place',
  infoOnly: g === 'attraction'
});
