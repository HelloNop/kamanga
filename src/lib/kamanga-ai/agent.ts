// Jalur model AI: persona + tool pencarian. Dipanggil hanya bila router tidak bisa memahami pesan.
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
import { listingDetailForModel, runListingSearch, toModelResult } from './search-tool';
import type { KamangaMessage } from './types';

export function buildTools(writer: UIMessageStreamWriter<KamangaMessage>, sessionId?: string) {
  return {
    search_listings: tool({
      description:
        'Cari jasa, tempat, wisata, freelancer, atau produk UMKM di direktori Kamanga. WAJIB dipanggil sebelum menyebut usaha apa pun. Kamus Minang dan nama lokasi dipahami otomatis.',
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            'Kebutuhan dengan kata warga apa adanya, mis. "onda mogok", "katering nasi kapau", "cuci AC".'
          ),
        location: z
          .string()
          .max(100)
          .optional()
          .describe(
            'Lokasi persis seperti disebut warga, mis. "lubeg". Kosongkan bila belum disebut.'
          ),
        budget_idr: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Anggaran maksimum dalam rupiah, bila disebut.'),
        budget_unit: z
          .enum(['per_person', 'per_hour', 'per_day', 'per_event', 'per_visit'])
          .optional()
          .describe('Satuan anggaran, bila jelas.'),
        min_capacity: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Kapasitas minimal (orang), untuk gedung atau tempat acara.'),
        service_mode: z
          .enum(['on_site', 'on_call', 'online'])
          .optional()
          .describe(
            'on_call = penyedia datang ke pelanggan; on_site = pelanggan datang; online = daring.'
          ),
        verified_only: z.boolean().optional().describe('true bila warga minta yang terverifikasi.')
      }),
      execute: async (a) => {
        const outcome = await runListingSearch({
          query: a.query,
          location: a.location,
          budget: a.budget_idr ? { max: a.budget_idr, unit: a.budget_unit } : undefined,
          minCapacity: a.min_capacity,
          serviceMode: a.service_mode,
          verifiedOnly: a.verified_only,
          limit: 5,
          meta: sessionId ? { sessionId, source: 'llm' } : undefined
        });
        // Kartu untuk warga ditulis KODE ke layar; model hanya menerima ringkasan.
        if (outcome.status === 'ok' && outcome.items.length)
          writer.write({
            type: 'data-listings',
            data: { items: outcome.items, total: outcome.total }
          });
        return toModelResult(outcome);
      }
    }),
    listing_detail: tool({
      description:
        'Ambil detail satu usaha (alamat, jam buka, catatan harga, tautan) dari id hasil search_listings. Panggil hanya bila warga menanyakan detail.',
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
  /** Sesi chat, untuk mencatat pencarian. */
  sessionId?: string;
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
    tools: buildTools(i.writer, i.sessionId),
    stopWhen: isStepCount(4),
    // Setelah pencarian dijalankan, langkah berikutnya WAJIB berupa jawaban teks. Tanpa ini model sering
    // mencari ulang dengan sinonim (3-4 langkah, 10+ detik) padahal sistem sudah memahami kamus dan sinonim.
    prepareStep: ({ steps }) =>
      steps.some((s) => s.toolCalls?.some((c) => c.toolName === 'search_listings'))
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
