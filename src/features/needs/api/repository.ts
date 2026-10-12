// Logika database kebutuhan. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { categories, categoryGroups, needCategories, needs } from '@/db/schema';
import { normAliases } from '@/lib/directory/norm';
import { pgArray } from '@/lib/directory/sql';
import { uniqueSlug } from '@/lib/unique-slug';
import { needFormSchema, type NeedFormValues } from '../schemas/need';
import type { NeedDetail, NeedFilters, NeedOptions, NeedsResponse, MutationResult } from './types';

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
  name: needs.name,
  sortOrder: needs.sortOrder,
  updatedAt: needs.updatedAt
} as const;

export async function listNeeds(f: NeedFilters): Promise<NeedsResponse> {
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conds: SQL[] = [];
  if (f.search?.trim()) {
    const q = `%${escapeLike(f.search.trim())}%`;
    conds.push(
      or(
        ilike(needs.name, q),
        ilike(needs.slug, q),
        sql`exists (select 1 from unnest(${needs.aliases}) a where a ilike ${q})`
      )!
    );
  }
  const status = csv(f.status).filter((s) => s === 'active' || s === 'inactive');
  if (status.length === 1) conds.push(eq(needs.isActive, status[0] === 'active'));
  const where = conds.length ? and(...conds) : undefined;

  let order: SQL[] = [asc(needs.sortOrder), asc(needs.name)];
  try {
    const picked = (JSON.parse(f.sort ?? '[]') as { id: string; desc: boolean }[]).filter(
      (s) => s.id in SORTABLE
    );
    if (picked.length)
      order = [
        ...picked.map((s) => (s.desc ? desc : asc)(SORTABLE[s.id as keyof typeof SORTABLE])),
        asc(needs.name)
      ];
  } catch {
    /* sort tidak valid: pakai urutan bawaan */
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(needs)
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(needs).where(where)
  ]);

  const ids = rows.map((r) => r.id);
  const links = ids.length
    ? await db
        .select({ needId: needCategories.needId, name: categories.name })
        .from(needCategories)
        .innerJoin(categories, eq(categories.id, needCategories.categoryId))
        .where(inArray(needCategories.needId, ids))
        .orderBy(asc(needCategories.sortOrder))
    : [];

  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      aliases: r.aliases,
      categoryNames: links.filter((l) => l.needId === r.id).map((l) => l.name),
      isActive: r.isActive,
      updatedAt: r.updatedAt.toISOString()
    })),
    total
  };
}

export async function getNeedDetail(id: number): Promise<NeedDetail | null> {
  const [n] = await db.select().from(needs).where(eq(needs.id, id)).limit(1);
  if (!n) return null;
  const links = await db
    .select({ categoryId: needCategories.categoryId })
    .from(needCategories)
    .where(eq(needCategories.needId, id))
    .orderBy(asc(needCategories.sortOrder));
  return {
    id: n.id,
    values: {
      name: n.name,
      slug: n.slug,
      description: n.description ?? '',
      aliases: n.aliases,
      categoryIds: links.map((l) => String(l.categoryId)),
      sortOrder: n.sortOrder,
      isActive: n.isActive
    }
  };
}

export async function getNeedOptions(): Promise<NeedOptions> {
  const cats = await db
    .select({ id: categories.id, name: categories.name, group: categoryGroups.name })
    .from(categories)
    .leftJoin(categoryGroups, eq(categoryGroups.id, categories.groupId))
    .where(eq(categories.isActive, true))
    .orderBy(asc(categoryGroups.name), asc(categories.name));
  return { categories: cats };
}

async function slugTaken(slug: string, exceptId?: number) {
  const [hit] = await db.select({ id: needs.id }).from(needs).where(eq(needs.slug, slug)).limit(1);
  return !!hit && hit.id !== exceptId;
}

async function resolveSlug(v: NeedFormValues, exceptId?: number): Promise<string | MutationResult> {
  if (v.slug)
    return (await slugTaken(v.slug, exceptId)) ? fail('Slug sudah dipakai kebutuhan lain') : v.slug;
  return uniqueSlug(v.name, (s) => slugTaken(s, exceptId), 'kebutuhan');
}

/** Sebutan lain tidak boleh sama dengan sebutan kebutuhan lain. */
async function aliasClash(v: NeedFormValues, exceptId?: number): Promise<MutationResult | null> {
  const list = normAliases(v.aliases);
  if (!list.length) return null;
  const rows = await db
    .select({ id: needs.id, name: needs.name, aliases: needs.aliases })
    .from(needs)
    .where(sql`${needs.aliases} && ${pgArray(list, 'text')}`);
  const hit = rows.find((r) => r.id !== exceptId);
  if (!hit) return null;
  const term = hit.aliases.find((a) => list.includes(a));
  return fail(`Sebutan "${term}" sudah dipakai kebutuhan ${hit.name}`);
}

/** Semua kategori yang dipilih harus ada. */
async function categoriesExist(v: NeedFormValues) {
  const ids = [...new Set(v.categoryIds.map(Number))];
  const found = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.id, ids));
  return found.length === ids.length;
}

const toDb = (v: NeedFormValues) => ({
  name: v.name.trim(),
  description: v.description.trim() || null,
  aliases: normAliases(v.aliases),
  sortOrder: v.sortOrder,
  isActive: v.isActive
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function saveLinks(tx: Tx, needId: number, v: NeedFormValues) {
  const ids = [...new Set(v.categoryIds.map(Number))];
  await tx.delete(needCategories).where(eq(needCategories.needId, needId));
  if (ids.length)
    await tx
      .insert(needCategories)
      .values(ids.map((categoryId, i) => ({ needId, categoryId, sortOrder: i })));
}

export async function createNeed(input: NeedFormValues): Promise<MutationResult> {
  const parsed = needFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  if (!(await categoriesExist(parsed.data))) return fail('Kategori tidak ditemukan. Muat ulang.');
  const clash = await aliasClash(parsed.data);
  if (clash) return clash;
  const slug = await resolveSlug(parsed.data);
  if (typeof slug !== 'string') return slug;
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(needs)
        .values({ ...toDb(parsed.data), slug })
        .returning({ id: needs.id });
      await saveLinks(tx, row.id, parsed.data);
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai kebutuhan lain' : 'Gagal menyimpan kebutuhan'
    );
  }
}

export async function updateNeed(id: number, input: NeedFormValues): Promise<MutationResult> {
  const parsed = needFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const [prev] = await db.select({ id: needs.id }).from(needs).where(eq(needs.id, id)).limit(1);
  if (!prev) return fail('Kebutuhan tidak ditemukan');
  if (!(await categoriesExist(parsed.data))) return fail('Kategori tidak ditemukan. Muat ulang.');
  const clash = await aliasClash(parsed.data, id);
  if (clash) return clash;
  const slug = await resolveSlug(parsed.data, id);
  if (typeof slug !== 'string') return slug;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(needs)
        .set({ ...toDb(parsed.data), slug })
        .where(eq(needs.id, id));
      await saveLinks(tx, id, parsed.data);
    });
    return { ok: true, id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai kebutuhan lain' : 'Gagal menyimpan kebutuhan'
    );
  }
}

export async function setNeedActive(id: number, isActive: boolean): Promise<MutationResult> {
  const rows = await db
    .update(needs)
    .set({ isActive })
    .where(eq(needs.id, id))
    .returning({ id: needs.id });
  return rows.length ? { ok: true, id } : fail('Kebutuhan tidak ditemukan');
}

export async function deleteNeed(id: number): Promise<MutationResult> {
  const rows = await db.delete(needs).where(eq(needs.id, id)).returning({ id: needs.id });
  return rows.length ? { ok: true, id } : fail('Kebutuhan tidak ditemukan');
}
