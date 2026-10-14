// Mesin Notifikasi. Diisi agent-wa (Gelombang 2). Kontrak: ../contracts.ts
// Pakai binding dari ../contracts (schedule, booking, ...) hanya di dalam fungsi, bukan di tingkat atas modul.
import type { NotifyEngine } from '../contracts';

const todo = (name: string) => (): never => {
  throw new Error(`Mesin Notifikasi: ${name} belum diisi (agent-wa)`);
};

export const notifyEngine: NotifyEngine = {
  sendWa: todo('sendWa'),
  requestOtp: todo('requestOtp'),
  verifyOtp: todo('verifyOtp')
};
