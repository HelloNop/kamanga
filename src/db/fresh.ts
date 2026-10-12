// Setara `migrate:fresh` di Laravel: HAPUS SELURUH ISI database lalu bangun ulang dari migrasi.
// Hanya untuk pengembangan lokal. Menolak jalan bila NODE_ENV=production atau database bukan di komputer ini.
// Dipakai lewat: bun run db:fresh   (migrasi + data acuan + akun admin)
//                bun run db:fresh:dummy   (ditambah data dummy)
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL belum diisi.');
  process.exit(1);
}
const { hostname, pathname } = new URL(url);
const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname);
if (process.env.NODE_ENV === 'production' || !isLocal) {
  console.error(
    `DITOLAK: db:fresh hanya untuk database lokal non-produksi (host "${hostname}", NODE_ENV "${process.env.NODE_ENV ?? ''}").`
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
console.log(`menghapus seluruh isi database "${pathname.slice(1)}" di ${hostname}...`);
await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE'); // catatan migrasi Drizzle
await pool.query('CREATE SCHEMA public');
await pool.end();
console.log('kosong. lanjut: migrasi...');
