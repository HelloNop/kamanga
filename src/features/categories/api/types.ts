import type { CategoryFormValues } from '../schemas/category';

export type { CategoryFormValues };

export type CategoryFilters = {
  page?: number;
  limit?: number;
  search?: string;
  group?: string; // slug kelompok, dipisah koma
  sort?: string; // JSON: [{ id, desc }]
};

export type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  group: string;
  extraGroups: string[];
  needsLocation: boolean;
  infoOnly: boolean;
  isActive: boolean;
  sortOrder: number;
  attributeCount: number;
  listingCount: number;
};

export type CategoryGroupOption = { id: number; name: string; slug: string; categoryCount: number };

export type CategoriesResponse = { items: CategoryRow[]; total: number };
export type CategoryDetail = { id: number; values: CategoryFormValues; listingCount: number };
export type MutationResult = { ok: true; id: number } | { ok: false; message: string };
export type GroupResult = { ok: true; id: number; name: string } | { ok: false; message: string };
