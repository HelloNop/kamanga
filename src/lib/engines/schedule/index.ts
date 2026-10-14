// Mesin Jadwal. Diisi agent-jadwal (Gelombang 2). Kontrak: ../contracts.ts
// Pakai binding dari ../contracts (schedule, booking, ...) hanya di dalam fungsi, bukan di tingkat atas modul.
import type { ScheduleEngine } from '../contracts';

const todo = (name: string) => (): never => {
  throw new Error(`Mesin Jadwal: ${name} belum diisi (agent-jadwal)`);
};

export const scheduleEngine: ScheduleEngine = {
  getAvailability: todo('getAvailability'),
  holdSlot: todo('holdSlot'),
  blockSlot: todo('blockSlot'),
  unblockSlot: todo('unblockSlot'),
  findConflicts: todo('findConflicts')
};
