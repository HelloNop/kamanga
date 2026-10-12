// Memeriksa antrean panggilan model AI. Jalankan: bun run check:queue
export {};
process.env.LLM_MAX_CONCURRENT = '2';
process.env.LLM_MAX_QUEUE = '2';
process.env.LLM_QUEUE_WAIT_MS = '300';
const { acquireLlmSlot, queueStats } = await import('./queue');

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'OK  ' : 'GAGAL'} ${name}`);
  if (!ok) failed++;
};

const a = await acquireLlmSlot();
const b = await acquireLlmSlot();
check('dua pertama langsung berjalan', a.ok && b.ok && queueStats().running === 2);

const c = acquireLlmSlot(); // menunggu
const d = acquireLlmSlot(); // menunggu
const e = await acquireLlmSlot(); // antrean penuh (maks 2)
check('lewat batas antrean ditolak seketika', !e.ok && e.reason === 'full');
check('dua menunggu', queueStats().waiting === 2);

if (a.ok) a.release();
if (a.ok) a.release(); // dilepas dua kali tidak boleh mengurangi dua kali
const cs = await c;
check('slot yang dilepas diberikan ke antrean terdepan', cs.ok && queueStats().running === 2);

const ds = await d; // tidak ada yang melepas: habis waktu
check('menunggu terlalu lama -> habis waktu', !ds.ok && ds.reason === 'timeout');
check('antrean kosong setelah habis waktu', queueStats().waiting === 0);

if (b.ok) b.release();
if (cs.ok) cs.release();
check('semua dilepas -> tidak ada yang berjalan', queueStats().running === 0);

console.log(failed ? `\n${failed} pemeriksaan gagal` : '\nqueue.check: OK');
process.exit(failed ? 1 : 0);
