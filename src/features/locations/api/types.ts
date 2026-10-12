import type { ImportError } from '../lib/csv';
import type { Level } from '../constants';
import type { LocationFormValues } from '../schemas/location';

export type { LocationFormValues, ImportError };

export type LocationFilters = {
  page?: number;
  limit?: number;
  search?: string;
  level?: string; // daftar dipisah koma
  sort?: string; // JSON: [{ id, desc }]
};

export type LocationRow = {
  id: number;
  slug: string;
  name: string;
  level: Level;
  parentName: string | null;
  aliases: string | null; // digabung dengan " | "
  hasCoords: boolean;
  listingCount: number;
};

export type LocationsResponse = { items: LocationRow[]; total: number };
export type LocationDetail = {
  id: number;
  values: LocationFormValues;
  listingCount: number;
  childCount: number;
};
export type LocationOption = {
  id: number;
  name: string;
  level: Level;
  parentName: string | null;
  /** Rantai induk tanpa provinsi, mis. "Padang Barat, Kota Padang". */
  path: string | null;
};
export type MutationResult = { ok: true; id: number } | { ok: false; message: string };

export type ImportPreview = {
  totals: { create: number; update: number };
  errorCount: number;
  errors: ImportError[]; // maksimal 100 pertama
  sample: {
    line: number;
    slug: string;
    name: string;
    level: Level;
    parentSlug: string | null;
    action: 'create' | 'update';
  }[];
};
export type ImportResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; message: string; errors: ImportError[] };
