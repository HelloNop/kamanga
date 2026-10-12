import type { NeedFormValues } from '../schemas/need';

export type { NeedFormValues };

export type NeedFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // active, inactive, atau keduanya
  sort?: string; // JSON: [{ id, desc }]
};

export type NeedRow = {
  id: number;
  slug: string;
  name: string;
  aliases: string[];
  categoryNames: string[];
  isActive: boolean;
  updatedAt: string; // ISO
};
export type NeedsResponse = { items: NeedRow[]; total: number };

export type NeedDetail = { id: number; values: NeedFormValues };

export type NeedOptions = {
  categories: { id: number; name: string; group: string | null }[];
};

export type MutationResult = { ok: true; id: number } | { ok: false; message: string };
