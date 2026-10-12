// Antrean untuk panggilan model AI: paling banyak `max` berjalan bersamaan, sisanya menunggu giliran
// (sampai `queue` orang dan `waitMs`). Melindungi batas permintaan vendor dan biaya saat ramai.
// Hanya berlaku dalam satu proses server. Bila nanti berjalan di banyak instance (serverless), batas
// ini berlaku per instance; untuk batas global perlu penyimpanan bersama (mis. Redis).
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d;
};
const limits = () => ({
  max: num(process.env.LLM_MAX_CONCURRENT, 8),
  queue: num(process.env.LLM_MAX_QUEUE, 16),
  waitMs: num(process.env.LLM_QUEUE_WAIT_MS, 20_000)
});
/** Jaring pengaman: slot dilepas sendiri bila pemanggil lupa melepas (mis. koneksi terputus). */
const HOLD_LIMIT_MS = 45_000;

type Waiter = { start: () => void; timer: ReturnType<typeof setTimeout> };
const state = ((
  globalThis as { __llmQueue?: { running: number; waiting: Waiter[] } }
).__llmQueue ??= { running: 0, waiting: [] });

export type Slot =
  | { ok: true; release: () => void; waitedMs: number }
  | { ok: false; reason: 'full' | 'timeout' };

function next() {
  const w = state.waiting.shift();
  if (!w) return;
  clearTimeout(w.timer);
  w.start();
}

export function acquireLlmSlot(): Promise<Slot> {
  const l = limits();
  const t0 = Date.now();
  const grant = (): Slot => {
    state.running++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimeout(guard);
      state.running--;
      next();
    };
    const guard = setTimeout(release, HOLD_LIMIT_MS);
    return { ok: true, release, waitedMs: Date.now() - t0 };
  };

  if (state.running < l.max) return Promise.resolve(grant());
  if (state.waiting.length >= l.queue) return Promise.resolve({ ok: false, reason: 'full' });
  return new Promise((resolve) => {
    const w: Waiter = {
      start: () => resolve(grant()),
      timer: setTimeout(() => {
        state.waiting = state.waiting.filter((x) => x !== w);
        resolve({ ok: false, reason: 'timeout' });
      }, l.waitMs)
    };
    state.waiting.push(w);
  });
}

export const queueStats = () => ({ running: state.running, waiting: state.waiting.length });
