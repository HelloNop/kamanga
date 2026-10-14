// Jalur model AI: persona + tool. Dipanggil hanya bila router (template → kode) tidak memahami pesan.
// Tool `cari` meneruskan kebutuhan yang dipahami model ke router dan mesin yang sama dengan jalur kode, jadi kartu,
// slot, dan harga tetap dibuat KODE dari database. Model hanya menulis kalimat pengantar.
import {
  isStepCount,
  streamText,
  tool,
  type ModelMessage,
  type UIMessageChunk,
  type UIMessageStreamWriter
} from 'ai';
import * as z from 'zod';
import type { ModelHandle, Usage } from './gateway';
import { PERSONA } from './persona';
import { decide, type TurnCtx } from './router';
import { listingDetailForModel, runListingSearch, toModelResult } from './search-tool';
import { execute } from './turn';
import type { ChatState, KamangaMessage, Reply } from './types';

export type ToolCtx = TurnCtx & {
  sessionId: string;
  userId?: string | null;
  /** Niat sesi; diperbarui tool, disimpan handler di akhir giliran. */
  stateRef: { current: ChatState };
};

/** Tulis bagian kartu dan tombol balasan kode ke layar. */
function writeParts(writer: UIMessageStreamWriter<KamangaMessage>, r: Reply) {
  if (r.listings) writer.write({ type: 'data-listings', data: r.listings });
  if (r.providers) writer.write({ type: 'data-providers', data: r.providers });
  if (r.chips?.length) writer.write({ type: 'data-chips', data: { options: r.chips } });
}

export function buildTools(writer: UIMessageStreamWriter<KamangaMessage>, c: ToolCtx) {
  return {
    cari: tool({
      description:
        'Cari penyedia atau tempat di Kamanga dan tampilkan kartunya (dengan jadwal kosong bila ada). WAJIB dipanggil sebelum menyebut usaha apa pun. Kamus Minang, nama daerah, waktu, dan jumlah orang dipahami otomatis.',
      inputSchema: z.object({
        kebutuhan: z
          .string()
          .min(1)
          .max(200)
          .describe('Kebutuhan dengan kata warga apa adanya, mis. "lapangan padel", "onda mogok".'),
        lokasi: z
          .string()
          .max(100)
          .optional()
          .describe(
            'Daerah persis seperti disebut warga, mis. "lubeg". Kosongkan bila belum disebut.'
          ),
        waktu: z
          .string()
          .max(60)
          .optional()
          .describe('Waktu seperti disebut warga, mis. "nanti malam", "besok jam 5".'),
        jumlah_orang: z.number().int().positive().max(60).optional(),
        anggaran_rp: z.number().int().positive().optional().describe('Anggaran maksimum (rupiah).')
      }),
      execute: async (a) => {
        const text = [
          a.kebutuhan,
          a.waktu,
          a.lokasi ? `di ${a.lokasi}` : '',
          a.jumlah_orang ? `${a.jumlah_orang} orang` : '',
          a.anggaran_rp ? `anggaran ${a.anggaran_rp}` : ''
        ]
          .filter(Boolean)
          .join(' ');
        const routed = await decide(text, c.stateRef.current, {
          ...c,
          action: null,
          point: null,
          fromModel: true
        });
        if (routed.decision.kind === 'llm') {
          // Kebutuhan di luar kategori yang dikenal: pencarian teks lama di direktori.
          const outcome = await runListingSearch({
            query: a.kebutuhan,
            location: a.lokasi,
            budget: a.anggaran_rp ? { max: a.anggaran_rp } : undefined,
            limit: 5,
            meta: { sessionId: c.sessionId, source: 'llm' }
          });
          if (outcome.status === 'ok' && outcome.items.length)
            writer.write({
              type: 'data-listings',
              data: { items: outcome.items, total: outcome.total }
            });
          return toModelResult(outcome);
        }
        const out = await execute(routed.decision, routed.state, {
          ...c,
          action: null,
          point: null,
          source: 'llm'
        });
        c.stateRef.current = out.state;
        writeParts(writer, out.reply);
        const cards = out.reply.providers?.items.length ?? out.reply.listings?.items.length ?? 0;
        return {
          status: cards ? 'ok' : out.reply.chips?.length ? 'perlu_info' : 'kosong',
          // Kalimat dari kode, tanpa nomor atau tautan. Kartu dan tombol sudah tampil di layar.
          ringkasan_kode: out.reply.text,
          jumlah_kartu: cards,
          catatan:
            'Kartu, jadwal, harga, dan tombol sudah tampil di layar. Tulis 1-2 kalimat saja; jangan mengulang daftar, harga, atau jam. Bila status perlu_info, sampaikan pertanyaan di ringkasan_kode.'
        };
      }
    }),
    listing_detail: tool({
      description:
        'Ambil detail satu usaha (jam buka, catatan harga, tautan) dari id hasil pencarian lama. Panggil hanya bila warga menanyakan detail.',
      inputSchema: z.object({ id: z.number().int().positive() }),
      execute: async ({ id }) => listingDetailForModel(id)
    })
  };
}

/**
 * Buang teks dari langkah yang memanggil tool ("Sebentar, saya carikan..."). Yang dibaca warga hanya
 * jawaban setelah hasil pencarian; pembuka di tengah langkah membuat teks tampak berantakan.
 */
function dropToolPreamble<S extends ReadableStream<UIMessageChunk>>(stream: S): S {
  let held: UIMessageChunk[] = [];
  let hasTool = false;
  const release = (c: TransformStreamDefaultController<UIMessageChunk>) => {
    if (!hasTool) held.forEach((h) => c.enqueue(h));
    held = [];
    hasTool = false;
  };
  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, c) {
        if (chunk.type.startsWith('text-')) {
          held.push(chunk);
          return;
        }
        if (chunk.type.startsWith('tool-')) hasTool = true;
        if (chunk.type === 'finish-step') release(c);
        c.enqueue(chunk);
      },
      flush: release
    })
  ) as S;
}

export type AgentInput = {
  writer: UIMessageStreamWriter<KamangaMessage>;
  handle: ModelHandle;
  history: { role: 'user' | 'assistant'; content: string }[];
  text: string;
  /** Arti kata dari kamus yang muncul di pesan. Dikirim sebagai catatan di pesan warga. */
  kamus?: { term: string; meaning: string }[];
  /** Konteks tool: sesi, niat berjalan, waktu. */
  tool: ToolCtx;
  onDone: (info: { usage: Usage; latencyMs: number; error?: string }) => Promise<void> | void;
  onError: (message: string) => void;
};

export function runAgent(i: AgentInput) {
  const t0 = Date.now();
  const messages: ModelMessage[] = [
    ...i.history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    {
      role: 'user',
      content: i.kamus?.length
        ? `${i.text}\n\n[Arti kata dari kamus: ${i.kamus.map((k) => `"${k.term}" = ${k.meaning}`).join('; ')}]`
        : i.text
    }
  ];
  const result = streamText({
    model: i.handle.model,
    // Bagian statis di depan (bisa di-cache vendor). Pada Anthropic, cache aktif bila prompt melewati batas minimum vendor.
    instructions: {
      role: 'system',
      content: PERSONA,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
    },
    messages,
    tools: buildTools(i.writer, i.tool),
    stopWhen: isStepCount(4),
    // Setelah pencarian dijalankan, langkah berikutnya WAJIB berupa jawaban teks. Tanpa ini model sering
    // mencari ulang dengan sinonim (3-4 langkah, 10+ detik) padahal sistem sudah memahami kamus dan sinonim.
    prepareStep: ({ steps }) =>
      steps.some((s) => s.toolCalls?.some((c) => c.toolName === 'cari'))
        ? { toolChoice: 'none' as const }
        : undefined,
    maxOutputTokens: 500,
    temperature: 0.3,
    timeout: { totalMs: 30_000 },
    onEnd: async (e) => {
      const u = e.totalUsage;
      await i.onDone({
        usage: {
          inputTokens: u.inputTokens,
          cachedTokens: u.inputTokenDetails?.cacheReadTokens,
          outputTokens: u.outputTokens
        },
        latencyMs: Date.now() - t0
      });
    },
    onError: async ({ error }) => {
      const message = error instanceof Error ? error.message : String(error);
      i.onError(message);
      await i.onDone({ usage: {}, latencyMs: Date.now() - t0, error: message.slice(0, 500) });
    }
  });
  i.writer.merge(dropToolPreamble(result.toUIMessageStream({ sendReasoning: false })));
}
