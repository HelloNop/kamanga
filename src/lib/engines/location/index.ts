// Mesin Lokasi. Diisi agent-lokasi (Gelombang 2). Kontrak: ../contracts.ts
// Pakai binding dari ../contracts (schedule, booking, ...) hanya di dalam fungsi, bukan di tingkat atas modul.
import type { LocationEngine } from '../contracts';

const todo = (name: string) => (): never => {
  throw new Error(`Mesin Lokasi: ${name} belum diisi (agent-lokasi)`);
};

export const locationEngine: LocationEngine = {
  resolvePoint: todo('resolvePoint'),
  resolvePlaceName: todo('resolvePlaceName'),
  isInServiceArea: todo('isInServiceArea'),
  nearestListings: todo('nearestListings'),
  formatDistance: todo('formatDistance'),
  serviceRegionIds: todo('serviceRegionIds')
};
