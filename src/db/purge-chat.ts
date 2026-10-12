// Masa simpan percakapan (UU PDP): menghapus isi percakapan yang lebih tua dari N hari (bawaan 90).
// - pesan dan sesi lama dihapus (klik kontak ikut terhapus);
// - catatan pencarian TETAP ada untuk statistik "Permintaan", tetapi kalimat aslinya dikosongkan;
// - catatan pemakaian model AI (llm_calls) tidak berisi teks, jadi tetap.
// Jalankan berkala di server (cron): bun run db:purge-chat [hari]
import { sql } from 'drizzle-orm';
import { db } from './index';

const days = Math.max(1, Math.floor(Number(process.argv[2] ?? 90)) || 90);
const cutoff = sql`now() - make_interval(days => ${days})`;

const result = await db.transaction(async (tx) => {
  const anonymized = await tx.execute(
    sql`update search_logs set query = null where query is not null and created_at < ${cutoff}`
  );
  const messages = await tx.execute(sql`delete from chat_messages where created_at < ${cutoff}`);
  const sessions = await tx.execute(sql`delete from chat_sessions where last_seen_at < ${cutoff}`);
  return {
    kalimatDikosongkan: anonymized.rowCount ?? 0,
    pesanDihapus: messages.rowCount ?? 0,
    sesiDihapus: sessions.rowCount ?? 0
  };
});

console.log(`Masa simpan ${days} hari:`, result);
process.exit(0);
