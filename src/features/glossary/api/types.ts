import type { GlossaryFormValues } from '../schemas/glossary';

export type { GlossaryFormValues };

export type GlossaryFilters = {
  page?: number;
  limit?: number;
  search?: string;
  checked?: string; // checked, unchecked, atau keduanya
  sort?: string; // JSON: [{ id, desc }]
};

export type GlossaryRow = {
  id: number;
  term: string;
  meaning: string;
  isChecked: boolean;
  notes: string | null;
  updatedAt: string; // ISO
};
export type GlossaryResponse = { items: GlossaryRow[]; total: number };

export type GlossaryDetail = { id: number; values: GlossaryFormValues };

export type MutationResult = { ok: true; id: number } | { ok: false; message: string };
