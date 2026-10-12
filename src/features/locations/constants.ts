import { LEVELS, type Level } from './lib/csv';

export { LEVELS };
export type { Level };

export const LEVEL_LABELS: Record<Level, string> = {
  province: 'Provinsi',
  city: 'Kota/Kabupaten',
  district: 'Kecamatan',
  village: 'Nagari/Kelurahan',
  landmark: 'Tempat dikenal'
};
export const LEVEL_OPTIONS = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
