// Memuat data/dummy-listings.csv lewat alur impor yang sama dengan panel admin (mode perbarui, aman diulang).
// Prasyarat: bun run db:seed-reference dan bun run auth:create-admin. Hapus semua dummy: bun run db:clear-dummy.
import { readFileSync } from 'node:fs';
import { runListingImport } from '@/features/listings/api/repository';
import { db } from './index';
import { user } from './schema';

const [admin] = await db.select({ id: user.id }).from(user).limit(1);
if (!admin) {
  console.error('Belum ada akun. Jalankan: bun run auth:create-admin');
  process.exit(1);
}
const csv = readFileSync(new URL('../../data/dummy-listings.csv', import.meta.url), 'utf8');
const r = await runListingImport(admin.id, csv, 'upsert');
if (!r.ok) {
  console.error('Gagal:', r.message, r.errors.slice(0, 10));
  process.exit(1);
}
console.log(`dummy    : ${r.created} baru, ${r.updated} diperbarui`);
process.exit(0);
