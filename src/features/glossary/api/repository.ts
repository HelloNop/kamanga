// Logika database kamus istilah. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { and, asc, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { glossaryTerms } from '@/db/schema';
import { norm } from '@/lib/directory/norm';
import { glossaryFormSchema, type GlossaryFormValues } from '../schemas/glossary';
import type { GlossaryDetail, GlossaryFilters, GlossaryResponse, MutationResult } from './types';

const csv = (s?: string | string[]) =>
  Array.isArray(s)
    ? s.map((x) => x.trim()).filter(Boolean)
    : s
      ? s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const fail = (message: string): MutationResult => ({ ok: false, message });
const isUniqueViolation = (e: unknown) =>
  (e as { cause?: { code?: string } })?.cause?.code === '23505';

const SORTABLE = {
  term: glossaryTerms.term,
  meaning: glossaryTerms.meaning,
  updatedAt: glossaryTerms.updatedAt
} as const;

export async function listGlossary(f: GlossaryFilters): Promise<GlossaryResponse> {
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conds: SQL[] = [];
  if (f.search?.trim()) {
    const q = `%${escapeLike(f.search.trim())}%`;
    conds.push(or(ilike(glossaryTerms.term, q), ilike(glossaryTerms.meaning, q))!);
  }
  const checked = csv(f.checked).filter((c) => c === 'checked' || c === 'unchecked');
  if (checked.length === 1) conds.push(eq(glossaryTerms.isChecked, checked[0] === 'checked'));
  const where = conds.length ? and(...conds) : undefined;

  let order: SQL[] = [asc(glossaryTerms.term)];
  try {
    const picked = (JSON.parse(f.sort ?? '[]') as { id: string; desc: boolean }[]).filter(
      (s) => s.id in SORTABLE
    );
    if (picked.length)
      order = [
        ...picked.map((s) => (s.desc ? desc : asc)(SORTABLE[s.id as keyof typeof SORTABLE])),
        asc(glossaryTerms.term)
      ];
  } catch {
    /* sort tidak valid: pakai urutan bawaan */
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: glossaryTerms.id,
        term: glossaryTerms.term,
        meaning: glossaryTerms.meaning,
        isChecked: glossaryTerms.isChecked,
        notes: glossaryTerms.notes,
        updatedAt: glossaryTerms.updatedAt
      })
      .from(glossaryTerms)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(glossaryTerms).where(where)
  ]);

  return {
    items: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
    total
  };
}

export async function getGlossaryDetail(id: number): Promise<GlossaryDetail | null> {
  const [r] = await db.select().from(glossaryTerms).where(eq(glossaryTerms.id, id)).limit(1);
  if (!r) return null;
  return {
    id: r.id,
    values: {
      term: r.term,
      meaning: r.meaning,
      notes: r.notes ?? '',
      isChecked: r.isChecked
    }
  };
}

function toRow(v: GlossaryFormValues) {
  return {
    // Mesin mencocokkan kata yang sudah diseragamkan (huruf kecil, tanpa tanda baca).
    term: norm(v.term),
    meaning: v.meaning.trim(),
    notes: v.notes.trim() || null,
    isChecked: v.isChecked
  };
}

export async function createGlossaryTerm(input: GlossaryFormValues): Promise<MutationResult> {
  const parsed = glossaryFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  try {
    const [row] = await db
      .insert(glossaryTerms)
      .values(toRow(parsed.data))
      .returning({ id: glossaryTerms.id });
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Istilah ini sudah ada di kamus' : 'Gagal menyimpan istilah'
    );
  }
}

export async function updateGlossaryTerm(
  id: number,
  input: GlossaryFormValues
): Promise<MutationResult> {
  const parsed = glossaryFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  try {
    const rows = await db
      .update(glossaryTerms)
      .set(toRow(parsed.data))
      .where(eq(glossaryTerms.id, id))
      .returning({ id: glossaryTerms.id });
    return rows.length ? { ok: true, id } : fail('Istilah tidak ditemukan');
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Istilah ini sudah ada di kamus' : 'Gagal menyimpan istilah'
    );
  }
}

export async function setGlossaryChecked(id: number, isChecked: boolean): Promise<MutationResult> {
  const rows = await db
    .update(glossaryTerms)
    .set({ isChecked })
    .where(eq(glossaryTerms.id, id))
    .returning({ id: glossaryTerms.id });
  return rows.length ? { ok: true, id } : fail('Istilah tidak ditemukan');
}

export async function deleteGlossaryTerm(id: number): Promise<MutationResult> {
  const rows = await db
    .delete(glossaryTerms)
    .where(eq(glossaryTerms.id, id))
    .returning({ id: glossaryTerms.id });
  return rows.length ? { ok: true, id } : fail('Istilah tidak ditemukan');
}
