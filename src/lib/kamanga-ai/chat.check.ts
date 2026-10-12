// Pemeriksaan satu giliran percakapan terhadap DATABASE SUNGGUHAN, memakai model AI tiruan (tanpa kunci API dan tanpa biaya).
// Prasyarat: data acuan + listing dummy: bun run db:fresh:dummy. Jalankan: bun run check:chat
// Data uji (sesi dengan ip_hash "test-ip-hash*" dan panggilan "mock-model") dihapus di akhir.
import assert from 'node:assert/strict';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions, llmCalls, searchLogs } from '@/db/schema';
import { getOrCreateSession } from './chat-store';
import { handleChatTurn } from './handler';

// Pemeriksaan 1-8 menguji jalur kode, jadi memakai mode hybrid. Pemeriksaan 9 menguji mode AI-first.
process.env.CHAT_MODE = 'hybrid';

type Chunk = { type: string; [k: string]: any };
async function collect(stream: ReadableStream<Chunk>) {
  const out: Chunk[] = [];
  const r = stream.getReader();
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    out.push(value);
  }
  const text = out
    .filter((c) => c.type === 'text-delta')
    .map((c) => c.delta)
    .join('');
  const listings = out.find((c) => c.type === 'data-listings')?.data;
  const chips = out.find((c) => c.type === 'data-chips')?.data?.options as string[] | undefined;
  return { chunks: out, text, listings, chips, types: out.map((c) => c.type) };
}
const lastRoute = async (sid: string) =>
  (
    await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sid))
      .orderBy(chatMessages.id)
  )
    .filter((m) => m.role === 'assistant')
    .at(-1)!;
const turn = async (sid: string, text: string, extra: any = {}) =>
  collect(await handleChatTurn({ sessionId: sid, ipHash: 'test-ip-hash', text, ...extra }));

const sid = await getOrCreateSession(null, 'test-ip-hash');
console.log('sesi dibuat');

// 1. jalur template (sapaan) + format aliran
let r = await turn(sid, 'halo');
assert.ok(r.types[0] === 'start' && r.types.at(-1) === 'finish' && r.chips!.length > 0);
assert.equal((await lastRoute(sid)).route, 'template');
console.log(
  '1. sapaan: template, aliran start..finish, tombol cepat =',
  r.chips!.slice(0, 3).join(' | ')
);

// 2. jalur kode (rules): kalimat jelas -> kartu, tanpa model AI
const callsBefore = await db.$count(llmCalls);
r = await turn(sid, 'onda mogok di lubeg tolong');
assert.ok(
  r.listings.items.length > 0 &&
    r.listings.items.every((i: any) => i.categorySlug === 'motorcycle-repair')
);
assert.equal((await lastRoute(sid)).route, 'rules');
assert.equal(await db.$count(llmCalls), callsBefore);
console.log(
  '2. onda mogok di lubeg: rules,',
  r.listings.items.length,
  'kartu, 0 panggilan model AI. teks =',
  JSON.stringify(r.text.split('\n')[0].slice(0, 70))
);
const row = await lastRoute(sid);
assert.match(row.content, /\[Ditampilkan: /); // model akan tahu apa yang sudah ditampilkan

// 3a. lokasi dari pesan sebelumnya tetap berlaku dalam sesi yang sama (dan disebut di balasan)
r = await turn(sid, 'servis ac');
assert.ok(r.listings.items.length > 0 && /Lubuk Begalung/.test(r.text));
// 3b. sesi baru: tanya balik lokasi, lalu dijawab di pesan berikutnya
const sid3 = await getOrCreateSession(null, 'test-ip-hash-3');
r = await turn(sid3, 'servis ac');
assert.match(r.text, /di mana lokasinya/i);
assert.equal(r.listings, undefined);
r = await turn(sid3, 'jakarta');
assert.match(r.text, /belum saya kenali sebagai lokasi/); // jawaban pendek di luar Sumbar
r = await turn(sid3, 'padang');
assert.ok(
  r.listings.items.length > 0 && r.listings.items.every((i: any) => i.categorySlug === 'ac-repair')
);
console.log(
  '3. lokasi terbawa dalam sesi; sesi baru: servis ac -> ditanya lokasi -> "padang" ->',
  r.listings.items.length,
  'kartu servis AC OK'
);

// 4. jalur model AI dengan model tiruan: model memanggil tool, lalu menjawab
let call = 0;
const seen: any[] = [];
const usage = (i: number, o: number) => ({
  inputTokens: { total: i, noCache: i - 4, cacheRead: 4, cacheWrite: undefined },
  outputTokens: { total: o, text: o, reasoning: undefined }
});
const mock = new MockLanguageModelV4({
  doStream: async (opts: any) => {
    seen.push(opts.prompt);
    call++;
    const chunks =
      call === 1
        ? [
            { type: 'stream-start', warnings: [] },
            {
              type: 'tool-call',
              toolCallId: 'c1',
              toolName: 'search_listings',
              input: JSON.stringify({ query: 'servis ac', location: 'padang' })
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: undefined },
              usage: usage(120, 20)
            }
          ]
        : [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'x' },
            {
              type: 'text-delta',
              id: 'x',
              delta: 'Ado beberapa jasa servis AC di Padang, Uda/Uni.'
            },
            { type: 'text-end', id: 'x' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: undefined },
              usage: usage(200, 15)
            }
          ];
    return {
      stream: simulateReadableStream({ chunks: chunks as any[], chunkDelayInMs: null }) as any
    };
  }
});
r = await turn(sid, 'tolong carikan yang bisa memperbaiki pendingin ruangan besok pagi', {
  modelOverride: { model: mock, id: 'mock-model' }
});
assert.equal(call, 2, 'model dipanggil 2 langkah');
assert.match(r.text, /jasa servis AC/);
assert.ok(r.listings?.items.length > 0, 'kartu ditulis kode dari hasil tool');
const llmRow = await lastRoute(sid);
assert.equal(llmRow.route, 'llm');
assert.match(llmRow.content, /jasa servis AC/);
const [rec] = await db.select().from(llmCalls).where(eq(llmCalls.model, 'mock-model'));
assert.ok(
  rec && rec.inputTokens === 320 && rec.cachedTokens === 8 && rec.outputTokens === 35,
  JSON.stringify(rec)
);
console.log(
  '4. jalur model AI: 2 langkah, tool dijalankan, kartu tampil, route=llm, pemakaian tercatat (masuk 320, cache 8, keluar 35)'
);
const promptText = JSON.stringify(seen[0]);
assert.ok(
  promptText.includes('onda mogok di lubeg') && promptText.includes('Kamanga'),
  'riwayat + persona ikut terkirim'
);
assert.ok(!promptText.includes('62800000'), 'nomor WhatsApp tidak dikirim ke model');
const toolResult = JSON.stringify(seen[1]);
assert.ok(!/6280{4,}/.test(toolResult), 'hasil tool untuk model tanpa nomor kontak');
console.log('   riwayat ikut terkirim; persona dikirim; nomor kontak TIDAK dikirim ke model OK');

// 5. tanpa vendor: pesan yang butuh model AI -> balasan bawaan yang jujur (bukan error)
process.env.LLM_PROVIDER = 'none';
r = await turn(sid, 'ceritakan lelucon');
assert.match(r.text, /alun paham|belum paham|Coba tulis/i);
assert.equal((await lastRoute(sid)).route, 'template');
console.log('5. tanpa vendor AI: balasan bawaan + tombol, route=template OK');

// 6. rem harian pemakaian model AI
process.env.LLM_PROVIDER = 'anthropic';
process.env.ANTHROPIC_API_KEY = 'sk-test';
process.env.LLM_DAILY_TOKEN_LIMIT = '100';
r = await turn(sid, 'ceritakan lelucon lagi');
assert.equal((await lastRoute(sid)).route, 'limit');
console.log(
  '6. rem harian token (batas 100, terpakai 355): model AI tidak dipanggil, route=limit OK'
);
delete process.env.LLM_DAILY_TOKEN_LIMIT;
process.env.LLM_PROVIDER = 'none';

// 7. batas pesan per sesi
process.env.CHAT_MAX_MESSAGES_PER_SESSION_DAY = '2';
const sid2 = await getOrCreateSession(null, 'test-ip-hash-2');
await turn(sid2, 'halo');
await turn(sid2, 'halo');
r = await turn(sid2, 'halo');
assert.match(r.text, /batas/);
assert.equal((await lastRoute(sid2)).route, 'limit');
delete process.env.CHAT_MAX_MESSAGES_PER_SESSION_DAY;
console.log('7. batas pesan per sesi (2/hari): pesan ke-3 ditolak sopan, route=limit OK');

// 8. pesan sangat panjang dipotong; isi aneh tidak merusak
await turn(sid, 'x'.repeat(5000));
await turn(sid, "'; drop table listings;--");
await turn(sid, '   ');
const longMsg = (await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sid))).find(
  (m) => m.content.startsWith('xxxx')
)!;
assert.equal(longMsg.content.length, 500);
console.log('8. pesan 5000 karakter dipotong jadi 500; isi aneh/kosong tidak merusak OK');

// 9. mode AI-first: yang dijawab kode hanya sapaan murni; lanjutan ("padang") ikut ke model AI, bukan templat
process.env.CHAT_MODE = 'ai';
const simple = new MockLanguageModelV4({
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'z' },
        { type: 'text-delta', id: 'z', delta: 'Baik, Uda/Uni.' },
        { type: 'text-end', id: 'z' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: undefined },
          usage: usage(100, 8)
        }
      ] as any[],
      chunkDelayInMs: null
    }) as any
  })
});
const viaMock = { modelOverride: { model: simple, id: 'mock-model' } };
const sidAi = await getOrCreateSession(null, 'test-ip-hash-ai');
r = await turn(sidAi, 'halo');
assert.equal((await lastRoute(sidAi)).route, 'template');
r = await turn(sidAi, 'ada tempat nongkrong asik ga', viaMock);
assert.equal((await lastRoute(sidAi)).route, 'llm');
r = await turn(sidAi, 'padang', viaMock);
assert.equal(
  (await lastRoute(sidAi)).route,
  'llm',
  '"padang" setelah pertanyaan harus ke model AI'
);
r = await turn(sidAi, 'servis ac di padang', viaMock);
assert.equal(
  (await lastRoute(sidAi)).route,
  'llm',
  'kalimat lengkap pun ke model AI pada mode ai-first'
);
r = await turn(sidAi, 'oke makasih, sekarang cari katering di padang', viaMock);
assert.equal(
  (await lastRoute(sidAi)).route,
  'llm',
  'terima kasih + permintaan bukan sekadar terima kasih'
);
process.env.LLM_PROVIDER = 'none';
r = await turn(sidAi, 'onda mogok di lubeg'); // tanpa model AI: kode menjadi cadangan
assert.equal((await lastRoute(sidAi)).route, 'rules');
assert.ok(r.listings?.items.length > 0);
console.log(
  '9. mode AI-first: sapaan=template; lanjutan "padang" dan kalimat lengkap=llm; tanpa model AI kode jadi cadangan OK'
);
process.env.CHAT_MODE = 'hybrid';

// bersih (catatan pencarian lebih dulu: kolom sesinya diisi null saat sesi dihapus)
const testSessions = db
  .select({ id: chatSessions.id })
  .from(chatSessions)
  .where(like(chatSessions.ipHash, 'test-ip-hash%'));
await db.delete(searchLogs).where(inArray(searchLogs.sessionId, testSessions));
await db.delete(chatSessions).where(like(chatSessions.ipHash, 'test-ip-hash%'));
await db.delete(llmCalls).where(eq(llmCalls.model, 'mock-model'));
console.log('bersih: data uji dihapus');
process.exit(0);
