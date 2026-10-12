// Menghapus SEMUA listing dummy (slug diawali "dummy-"). Listing sungguhan tidak tersentuh.
import { like } from 'drizzle-orm';
import { db } from './index';
import { listings } from './schema';

const gone = await db
  .delete(listings)
  .where(like(listings.slug, 'dummy-%'))
  .returning({ id: listings.id });
console.log(`dummy    : ${gone.length} listing dihapus`);
process.exit(0);
