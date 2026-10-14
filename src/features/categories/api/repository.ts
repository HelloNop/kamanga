// Logika database kategori. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import {
  categories,
  categoryExtraGroups,
  categoryGroups,
  doors,
  listingCategories
} from '@/db/schema';
import { hasOptions, parseAttributeSchema } from '@/features/listings/lib/format';
import { normAliases } from '@/lib/directory/norm';
import { pgArray } from '@/lib/directory/sql';
import { slugify } from '@/lib/slug';
import { uniqueSlug } from '@/lib/unique-slug';
import { categoryFormSchema, groupNameSchema, type CategoryFormValues } from '../schemas/category';
import type {
  CategoriesResponse,
  CategoryDetail,
  CategoryFilters,
  CategoryGroupOption,
  GroupResult,
  MutationResult
} from './types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
const fail = (message: string) => ({ ok: false as const, message });
const isUniqueViolation = (e: unknown) =>
  (e as { cause?: { code?: string } })?.cause?.code === '23505';

const listingCountSql = sql<number>`(select count(*)::int from ${listingCategories} where ${listingCategories.categoryId} = ${categories.id})`;
const SORTABLE = {
  name: categories.name,
  group: categoryGroups.name,
  sortOrder: categories.sortOrder
} as const;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Isian baru (kode kosong) diberi kode dari labelnya: "Terima BPJS" -> terima_bpjs; "Kapasitas (orang)" -> capacity. */
function withKeys(attrs: CategoryFormValues['attributes']) {
  const used = new Set(attrs.map((a) => a.key).filter(Boolean));
  return attrs.map((a) => {
    if (a.key) return a;
    // Mesin menyaring jumlah tamu lewat kode `capacity`, jadi "Kapasitas ..." memakai kode itu.
    const base = /^kapasitas\b/i.test(a.label.trim())
      ? 'capacity'
      : slugify(a.label)
          .replace(/-/g, '_')
          .replace(/^[^a-z]+/, '')
          .slice(0, 26) || 'isian';
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    return { ...a, key };
  });
}

export async function listGroups(): Promise<CategoryGroupOption[]> {
  return db
    .select({
      id: categoryGroups.id,
      name: categoryGroups.name,
      slug: categoryGroups.slug,
      categoryCount: sql<number>`(select count(*)::int from ${categories} where ${categories.groupId} = ${categoryGroups.id})`
    })
    .from(categoryGroups)
    .orderBy(asc(categoryGroups.sortOrder), asc(categoryGroups.name));
}

const groupUseCount = async (id: number) => {
  const [{ n }] = await db.select({ n: sql<number>`count(distinct c)::int` }).from(
    sql`(select ${categories.id} as c from ${categories} where ${categories.groupId} = ${id}
           union select ${categoryExtraGroups.categoryId} from ${categoryExtraGroups}
           where ${categoryExtraGroups.groupId} = ${id}) u`
  );
  return n;
};

const groupNameTaken = async (name: string, exceptId?: number) => {
  const [hit] = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(sql`lower(${categoryGroups.name}) = lower(${name})`)
    .limit(1);
  return !!hit && hit.id !== exceptId;
};

export async function createGroup(input: string): Promise<GroupResult> {
  const parsed = groupNameSchema.safeParse(norm(input));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Nama tidak valid');
  const name = parsed.data;
  if (await groupNameTaken(name)) return fail(`Kelompok "${name}" sudah ada`);
  const slug = await uniqueSlug(
    name,
    async (s) =>
      !!(
        await db
          .select({ id: categoryGroups.id })
          .from(categoryGroups)
          .where(eq(categoryGroups.slug, s))
          .limit(1)
      )[0],
    'kelompok'
  );
  const [row] = await db
    .insert(categoryGroups)
    .values({ name, slug })
    .returning({ id: categoryGroups.id });
  return { ok: true, id: row.id, name };
}

export async function renameGroup(id: number, input: string): Promise<GroupResult> {
  const parsed = groupNameSchema.safeParse(norm(input));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Nama tidak valid');
  const name = parsed.data;
  if (await groupNameTaken(name, id)) return fail(`Kelompok "${name}" sudah ada`);
  const rows = await db
    .update(categoryGroups)
    .set({ name })
    .where(eq(categoryGroups.id, id))
    .returning({ id: categoryGroups.id });
  return rows.length ? { ok: true, id, name } : fail('Kelompok tidak ditemukan');
}

// Kelompok yang masih punya kategori tidak boleh dihapus.
export async function deleteGroup(id: number): Promise<MutationResult> {
  const used = await groupUseCount(id);
  if (used > 0) return fail(`Masih dipakai ${used} kategori. Pindahkan kategorinya dulu.`);
  const rows = await db
    .delete(categoryGroups)
    .where(eq(categoryGroups.id, id))
    .returning({ id: categoryGroups.id });
  return rows.length ? { ok: true, id } : fail('Kelompok tidak ditemukan');
}

export async function listCategories(f: CategoryFilters): Promise<CategoriesResponse> {
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conds: SQL[] = [];
  if (f.search?.trim()) {
    const q = `%${escapeLike(f.search.trim())}%`;
    conds.push(or(ilike(categories.name, q), ilike(categories.slug, q))!);
  }
  const groupSlugs = csv(f.group);
  if (groupSlugs.length) {
    const ids = db
      .select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(inArray(categoryGroups.slug, groupSlugs));
    conds.push(
      or(
        inArray(categories.groupId, ids),
        exists(
          db
            .select({ one: sql`1` })
            .from(categoryExtraGroups)
            .where(
              and(
                eq(categoryExtraGroups.categoryId, categories.id),
                inArray(categoryExtraGroups.groupId, ids)
              )
            )
        )
      )!
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  let order: SQL[] = [asc(categories.sortOrder), asc(categories.name)];
  try {
    const picked = (JSON.parse(f.sort ?? '[]') as { id: string; desc: boolean }[]).filter(
      (s) => s.id in SORTABLE
    );
    if (picked.length)
      order = picked.map((s) => (s.desc ? desc : asc)(SORTABLE[s.id as keyof typeof SORTABLE]));
  } catch {
    /* sort tidak valid: pakai urutan bawaan */
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        group: categoryGroups.name,
        needsLocation: categories.needsLocation,
        infoOnly: categories.infoOnly,
        isActive: categories.isActive,
        sortOrder: categories.sortOrder,
        attributeSchema: categories.attributeSchema,
        listingCount: listingCountSql,
        door: doors.name,
        scheduleKind: categories.scheduleKind
      })
      .from(categories)
      .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .leftJoin(doors, eq(doors.id, categories.doorId))
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(categories).where(where)
  ]);

  const extras = rows.length
    ? await db
        .select({ categoryId: categoryExtraGroups.categoryId, name: categoryGroups.name })
        .from(categoryExtraGroups)
        .innerJoin(categoryGroups, eq(categoryExtraGroups.groupId, categoryGroups.id))
        .where(
          inArray(
            categoryExtraGroups.categoryId,
            rows.map((r) => r.id)
          )
        )
        .orderBy(asc(categoryGroups.name))
    : [];

  return {
    items: rows.map(({ attributeSchema, ...r }) => ({
      ...r,
      extraGroups: extras.filter((e) => e.categoryId === r.id).map((e) => e.name),
      attributeCount: parseAttributeSchema(attributeSchema).length
    })),
    total
  };
}

export async function getCategoryDetail(id: number): Promise<CategoryDetail | null> {
  const [row] = await db
    .select({ c: categories, listingCount: listingCountSql })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!row) return null;
  const c = row.c;
  const extras = await db
    .select({ id: categoryGroups.id })
    .from(categoryExtraGroups)
    .innerJoin(categoryGroups, eq(categoryExtraGroups.groupId, categoryGroups.id))
    .where(eq(categoryExtraGroups.categoryId, id))
    .orderBy(asc(categoryGroups.name));
  return {
    id: c.id,
    listingCount: row.listingCount,
    values: {
      name: c.name,
      slug: c.slug,
      groupId: c.groupId,
      extraGroupIds: extras.map((e) => e.id),
      aliases: c.aliases,
      needsLocation: c.needsLocation,
      infoOnly: c.infoOnly,
      description: c.description ?? '',
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      attributes: parseAttributeSchema(c.attributeSchema).map((a) => ({
        ...a,
        options: a.options ?? []
      })),
      doorId: c.doorId ? String(c.doorId) : '',
      scheduleKind: c.scheduleKind,
      responseMinutes: c.responseMinutes ?? undefined
    }
  };
}

async function slugTaken(slug: string, exceptId?: number) {
  const [hit] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return !!hit && hit.id !== exceptId;
}

async function resolveSlug(
  v: CategoryFormValues,
  exceptId?: number
): Promise<string | MutationResult> {
  if (v.slug)
    return (await slugTaken(v.slug, exceptId)) ? fail('Slug sudah dipakai kategori lain') : v.slug;
  return uniqueSlug(v.name, (s) => slugTaken(s, exceptId), 'kategori');
}

const toDb = (v: CategoryFormValues) => ({
  name: v.name.trim(),
  aliases: normAliases(v.aliases),
  groupId: v.groupId,
  needsLocation: v.needsLocation,
  infoOnly: v.infoOnly,
  description: v.description.trim() || null,
  sortOrder: v.sortOrder,
  isActive: v.isActive,
  doorId: v.doorId ? Number(v.doorId) : null,
  scheduleKind: v.scheduleKind,
  responseMinutes: v.responseMinutes ?? null,
  attributeSchema: withKeys(v.attributes).map((a) => ({
    key: a.key,
    label: a.label.trim(),
    type: a.type,
    ...(hasOptions(a.type) && { options: [...new Set(a.options.map((o) => o.trim()))] })
  }))
});

/** Sebutan lain tidak boleh sama dengan sebutan kategori lain (chatbot jadi tidak tahu memilih). */
async function aliasClash(
  v: CategoryFormValues,
  exceptId?: number
): Promise<MutationResult | null> {
  const list = normAliases(v.aliases);
  if (!list.length) return null;
  const rows = await db
    .select({ id: categories.id, name: categories.name, aliases: categories.aliases })
    .from(categories)
    .where(sql`${categories.aliases} && ${pgArray(list, 'text')}`);
  const hit = rows.find((r) => r.id !== exceptId);
  if (!hit) return null;
  const term = hit.aliases.find((a) => list.includes(a));
  return fail(`Sebutan "${term}" sudah dipakai kategori ${hit.name}`);
}

/** Kelompok tambahan (tanpa kelompok utama dan tanpa duplikat). */
const extraIdsOf = (v: CategoryFormValues) => [
  ...new Set(v.extraGroupIds.filter((g) => g !== v.groupId))
];

/** Pastikan semua kelompok yang dipilih masih ada (bisa terhapus dari tab lain). */
async function groupsExist(v: CategoryFormValues) {
  const ids = [v.groupId, ...extraIdsOf(v)];
  const found = await db
    .select({ id: categoryGroups.id })
    .from(categoryGroups)
    .where(inArray(categoryGroups.id, ids));
  return found.length === new Set(ids).size;
}

async function saveExtraGroups(tx: Tx, categoryId: number, v: CategoryFormValues) {
  const extraIds = extraIdsOf(v);
  await tx.delete(categoryExtraGroups).where(eq(categoryExtraGroups.categoryId, categoryId));
  if (extraIds.length)
    await tx
      .insert(categoryExtraGroups)
      .values(extraIds.map((groupId) => ({ categoryId, groupId })));
}

export async function createCategory(input: CategoryFormValues): Promise<MutationResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  if (!(await groupsExist(parsed.data)))
    return fail('Kelompok tidak ditemukan. Muat ulang halaman.');
  const clash = await aliasClash(parsed.data);
  if (clash) return clash;
  const slug = await resolveSlug(parsed.data);
  if (typeof slug !== 'string') return slug;
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(categories)
        .values({ ...toDb(parsed.data), slug })
        .returning({ id: categories.id });
      await saveExtraGroups(tx, row.id, parsed.data);
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai kategori lain' : 'Gagal menyimpan kategori'
    );
  }
}

export async function updateCategory(
  id: number,
  input: CategoryFormValues
): Promise<MutationResult> {
  const parsed = categoryFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const [prev] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!prev) return fail('Kategori tidak ditemukan');
  if (!(await groupsExist(parsed.data)))
    return fail('Kelompok tidak ditemukan. Muat ulang halaman.');
  const clash = await aliasClash(parsed.data, id);
  if (clash) return clash;
  const slug = await resolveSlug(parsed.data, id);
  if (typeof slug !== 'string') return slug;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(categories)
        .set({ ...toDb(parsed.data), slug })
        .where(eq(categories.id, id));
      await saveExtraGroups(tx, id, parsed.data);
    });
    return { ok: true, id };
  } catch (e) {
    return fail(
      isUniqueViolation(e) ? 'Slug sudah dipakai kategori lain' : 'Gagal menyimpan kategori'
    );
  }
}

export async function setCategoryActive(id: number, isActive: boolean): Promise<MutationResult> {
  const rows = await db
    .update(categories)
    .set({ isActive })
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  return rows.length ? { ok: true, id } : fail('Kategori tidak ditemukan');
}

// Kategori yang masih dipakai listing tidak boleh dihapus; nonaktifkan saja.
export async function deleteCategory(id: number): Promise<MutationResult> {
  const [{ used }] = await db
    .select({ used: count() })
    .from(listingCategories)
    .where(eq(listingCategories.categoryId, id));
  if (used > 0) return fail(`Masih dipakai ${used} listing. Nonaktifkan saja, jangan dihapus.`);
  const rows = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });
  return rows.length ? { ok: true, id } : fail('Kategori tidak ditemukan');
}
