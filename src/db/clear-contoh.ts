// Menghapus SEMUA data contoh: listing dummy, lalu kategori, kebutuhan, dan kelompok berslug "contoh-*",
// serta kata kamus bercatatan "Data contoh". Data sungguhan tidak tersentuh.
// Jalankan: bun run db:clear-contoh
import { and, eq, like, notExists } from 'drizzle-orm';
import { db } from './index';
import { categories, categoryGroups, glossaryTerms, listings, needs } from './schema';

const gone = await db
  .delete(listings)
  .where(like(listings.slug, 'dummy-%'))
  .returning({ id: listings.id });
const n = await db.delete(needs).where(like(needs.slug, 'contoh-%')).returning({ id: needs.id });
const c = await db
  .delete(categories)
  .where(like(categories.slug, 'contoh-%'))
  .returning({ id: categories.id });
// Kelompok dihapus hanya bila sudah kosong (kategori sungguhan mungkin memakainya).
const g = await db
  .delete(categoryGroups)
  .where(
    and(
      like(categoryGroups.slug, 'contoh-%'),
      notExists(
        db
          .select({ x: categories.id })
          .from(categories)
          .where(eq(categories.groupId, categoryGroups.id))
      )
    )
  )
  .returning({ id: categoryGroups.id });
const k = await db
  .delete(glossaryTerms)
  .where(eq(glossaryTerms.notes, 'Data contoh'))
  .returning({ id: glossaryTerms.id });
console.log(
  `contoh   : ${gone.length} listing, ${c.length} kategori, ${n.length} kebutuhan, ${g.length} kelompok, ${k.length} kata kamus dihapus`
);
process.exit(0);
