// Logika database lokasi. TANPA pemeriksaan login: hanya diimpor oleh service.ts.
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { listingAreas, listings, locationAliases, locations } from '@/db/schema';
import { uniqueSlug } from '@/lib/unique-slug';
import { LEVELS, type Level } from '../constants';
import {
  LEVEL_RANK,
  parseLocationCsv,
  planImport,
  type CsvLocationRow,
  type ImportError
} from '../lib/csv';
import { locationFormSchema, type LocationFormValues } from '../schemas/location';
import type {
  ImportPreview,
  ImportResult,
  LocationDetail,
  LocationFilters,
  LocationOption,
  LocationsResponse,
  MutationResult
} from './types';

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
const chunk = <T>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const parent = alias(locations, 'parent');
const aliasesSql = sql<
  string | null
>`(select string_agg(${locationAliases.alias}, ' | ' order by ${locationAliases.alias}) from ${locationAliases} where ${locationAliases.locationId} = ${locations.id})`;
const listingCountSql = sql<number>`(select count(*)::int from ${listings} where ${listings.locationId} = ${locations.id})`;
const SORTABLE = { name: locations.name, level: locations.level } as const;

// ───────────────────────────── Baca ─────────────────────────────

export async function listLocations(f: LocationFilters): Promise<LocationsResponse> {
  const limit = Math.min(Math.max(f.limit ?? 10, 1), 100);
  const page = Math.max(f.page ?? 1, 1);

  const conds: SQL[] = [];
  if (f.search?.trim()) {
    const q = `%${escapeLike(f.search.trim())}%`;
    conds.push(
      or(
        ilike(locations.name, q),
        ilike(locations.slug, q),
        exists(
          db
            .select({ x: sql`1` })
            .from(locationAliases)
            .where(
              and(eq(locationAliases.locationId, locations.id), ilike(locationAliases.alias, q))
            )
        )
      )!
    );
  }
  const levels = csv(f.level).filter((l): l is Level => (LEVELS as readonly string[]).includes(l));
  if (levels.length) conds.push(inArray(locations.level, levels));
  const where = conds.length ? and(...conds) : undefined;

  let order: SQL[] = [asc(locations.level), asc(locations.name)];
  try {
    const picked = (JSON.parse(f.sort ?? '[]') as { id: string; desc: boolean }[]).filter(
      (s) => s.id in SORTABLE
    );
    if (picked.length)
      order = [
        ...picked.map((s) => (s.desc ? desc : asc)(SORTABLE[s.id as keyof typeof SORTABLE])),
        asc(locations.name)
      ];
  } catch {
    /* sort tidak valid: pakai urutan bawaan */
  }

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: locations.id,
        slug: locations.slug,
        name: locations.name,
        level: locations.level,
        parentName: parent.name,
        aliases: aliasesSql,
        lat: locations.lat,
        listingCount: listingCountSql
      })
      .from(locations)
      .leftJoin(parent, eq(parent.id, locations.parentId))
      .where(where)
      .orderBy(...order)
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(locations).where(where)
  ]);

  return { items: rows.map(({ lat, ...r }) => ({ ...r, hasCoords: lat !== null })), total };
}

export async function getLocationOptions(): Promise<LocationOption[]> {
  const rows = await db
    .select({
      id: locations.id,
      name: locations.name,
      level: locations.level,
      parentId: locations.parentId
    })
    .from(locations)
    .orderBy(asc(locations.level), asc(locations.name));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (parentId: number | null) => {
    const names: string[] = [];
    for (let p = parentId, n = 0; p && n < 6; n++) {
      const l = byId.get(p);
      if (!l || l.level === 'province') break;
      names.push(l.name);
      p = l.parentId;
    }
    return names.length ? names.join(', ') : null;
  };
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    level: r.level,
    parentName: r.parentId ? (byId.get(r.parentId)?.name ?? null) : null,
    path: pathOf(r.parentId)
  }));
}

export async function getLocationDetail(id: number): Promise<LocationDetail | null> {
  const [row] = await db
    .select({
      l: locations,
      listingCount: listingCountSql,
      childCount: sql<number>`(select count(*)::int from ${locations} c where c.parent_id = ${locations.id})`
    })
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  if (!row) return null;
  const aliases = await db
    .select({ alias: locationAliases.alias })
    .from(locationAliases)
    .where(eq(locationAliases.locationId, id))
    .orderBy(asc(locationAliases.alias));
  const l = row.l;
  return {
    id: l.id,
    listingCount: row.listingCount,
    childCount: row.childCount,
    values: {
      name: l.name,
      slug: l.slug,
      level: l.level,
      parentId: l.parentId ? String(l.parentId) : '',
      lat: l.lat ?? undefined,
      lng: l.lng ?? undefined,
      aliases: aliases.map((a) => a.alias)
    }
  };
}

// ───────────────────────────── Tulis ─────────────────────────────

async function slugTaken(slug: string, exceptId?: number) {
  const [hit] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.slug, slug))
    .limit(1);
  return !!hit && hit.id !== exceptId;
}

async function resolveSlug(
  v: LocationFormValues,
  exceptId?: number
): Promise<string | MutationResult> {
  if (v.slug)
    return (await slugTaken(v.slug, exceptId)) ? fail('Slug sudah dipakai lokasi lain') : v.slug;
  return uniqueSlug(v.name, (s) => slugTaken(s, exceptId), 'lokasi');
}

// Induk harus ada dan berada di tingkat yang lebih tinggi; anak yang sudah ada harus tetap lebih rendah.
async function checkHierarchy(v: LocationFormValues, id?: number): Promise<MutationResult | null> {
  if (v.parentId) {
    if (id && Number(v.parentId) === id) return fail('Induk tidak boleh lokasi itu sendiri');
    const [p] = await db
      .select({ level: locations.level })
      .from(locations)
      .where(eq(locations.id, Number(v.parentId)))
      .limit(1);
    if (!p) return fail('Induk tidak ditemukan');
    if (LEVEL_RANK[p.level] >= LEVEL_RANK[v.level])
      return fail(`Induk (${p.level}) harus berada di tingkat lebih tinggi dari ${v.level}`);
  }
  if (id) {
    const kids = await db
      .select({ level: locations.level })
      .from(locations)
      .where(eq(locations.parentId, id));
    if (kids.some((k) => LEVEL_RANK[k.level] <= LEVEL_RANK[v.level])) {
      return fail(
        'Tingkat ini tidak boleh lebih rendah atau sama dengan tingkat lokasi di bawahnya'
      );
    }
  }
  return null;
}

const aliasRows = (locationId: number, aliases: string[]) =>
  [...new Set(aliases.map((a) => a.trim()).filter(Boolean))].map((a) => ({ locationId, alias: a }));

export async function createLocation(input: LocationFormValues): Promise<MutationResult> {
  const parsed = locationFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const v = parsed.data;
  const bad = await checkHierarchy(v);
  if (bad) return bad;
  const slug = await resolveSlug(v);
  if (typeof slug !== 'string') return slug;
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(locations)
        .values({
          slug,
          name: v.name.trim(),
          level: v.level,
          parentId: v.parentId ? Number(v.parentId) : null,
          lat: v.lat ?? null,
          lng: v.lng ?? null
        })
        .returning({ id: locations.id });
      const rows = aliasRows(row.id, v.aliases);
      if (rows.length) await tx.insert(locationAliases).values(rows);
      return row.id;
    });
    return { ok: true, id };
  } catch (e) {
    return fail(isUniqueViolation(e) ? 'Slug sudah dipakai lokasi lain' : 'Gagal menyimpan lokasi');
  }
}

export async function updateLocation(
  id: number,
  input: LocationFormValues
): Promise<MutationResult> {
  const parsed = locationFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const v = parsed.data;
  const [prev] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  if (!prev) return fail('Lokasi tidak ditemukan');
  const bad = await checkHierarchy(v, id);
  if (bad) return bad;
  const slug = await resolveSlug(v, id);
  if (typeof slug !== 'string') return slug;
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(locations)
        .set({
          slug,
          name: v.name.trim(),
          level: v.level,
          parentId: v.parentId ? Number(v.parentId) : null,
          lat: v.lat ?? null,
          lng: v.lng ?? null
        })
        .where(eq(locations.id, id));
      await tx.delete(locationAliases).where(eq(locationAliases.locationId, id));
      const rows = aliasRows(id, v.aliases);
      if (rows.length) await tx.insert(locationAliases).values(rows);
    });
    return { ok: true, id };
  } catch (e) {
    return fail(isUniqueViolation(e) ? 'Slug sudah dipakai lokasi lain' : 'Gagal menyimpan lokasi');
  }
}

// Tidak boleh dihapus selama masih punya anak atau dipakai listing.
export async function deleteLocation(id: number): Promise<MutationResult> {
  const [[{ kids }], [{ used }], [{ areas }]] = await Promise.all([
    db.select({ kids: count() }).from(locations).where(eq(locations.parentId, id)),
    db.select({ used: count() }).from(listings).where(eq(listings.locationId, id)),
    db.select({ areas: count() }).from(listingAreas).where(eq(listingAreas.locationId, id))
  ]);
  const reasons = [
    kids && `${kids} lokasi di bawahnya`,
    used && `${used} listing`,
    areas && `${areas} area layanan`
  ].filter(Boolean);
  if (reasons.length) return fail(`Masih dipakai oleh ${reasons.join(', ')}.`);
  const rows = await db
    .delete(locations)
    .where(eq(locations.id, id))
    .returning({ id: locations.id });
  return rows.length ? { ok: true, id } : fail('Lokasi tidak ditemukan');
}

// ───────────────────────────── Impor CSV ─────────────────────────────

const MAX_CSV_CHARS = 900_000; // di bawah batas 1 MB Server Action

type Prepared = {
  ordered: CsvLocationRow[];
  existing: Map<string, { id: number; level: Level }>;
  errors: ImportError[];
};

async function prepareImport(text: string): Promise<Prepared> {
  if (text.length > MAX_CSV_CHARS) {
    return {
      ordered: [],
      existing: new Map(),
      errors: [{ line: 1, message: 'File terlalu besar (maksimal sekitar 900 KB)' }]
    };
  }
  const { rows, errors: syntax } = parseLocationCsv(text);
  const slugs = [
    ...new Set(rows.flatMap((r) => (r.parentSlug ? [r.slug, r.parentSlug] : [r.slug])))
  ];
  const found = slugs.length
    ? (
        await Promise.all(
          chunk(slugs, 2000).map((c) =>
            db
              .select({ id: locations.id, slug: locations.slug, level: locations.level })
              .from(locations)
              .where(inArray(locations.slug, c))
          )
        )
      ).flat()
    : [];
  const existing = new Map(found.map((r) => [r.slug, { id: r.id, level: r.level }]));

  const plan = planImport(rows, existing);
  // Tingkat lokasi yang sudah ada tidak diubah lewat impor (bisa merusak hirarki anaknya).
  const levelErrors = plan.ordered
    .filter((r) => existing.has(r.slug) && existing.get(r.slug)!.level !== r.level)
    .map((r) => ({
      line: r.line,
      message: `"${r.slug}" sudah ada dengan level ${existing.get(r.slug)!.level}; ubah level lewat formulir, bukan impor`
    }));
  const errors = [...syntax, ...plan.errors, ...levelErrors].sort((a, b) => a.line - b.line);
  return { ordered: plan.ordered, existing, errors };
}

export async function previewImport(text: string): Promise<ImportPreview> {
  const { ordered, existing, errors } = await prepareImport(text);
  const action = (r: CsvLocationRow) =>
    existing.has(r.slug) ? ('update' as const) : ('create' as const);
  return {
    totals: {
      create: ordered.filter((r) => action(r) === 'create').length,
      update: ordered.filter((r) => action(r) === 'update').length
    },
    errorCount: errors.length,
    errors: errors.slice(0, 100),
    sample: ordered.slice(0, 15).map((r) => ({
      line: r.line,
      slug: r.slug,
      name: r.name,
      level: r.level,
      parentSlug: r.parentSlug,
      action: action(r)
    }))
  };
}

// Semua-atau-tidak-sama-sekali: bila ada satu kesalahan, tidak ada yang tersimpan.
// Lokasi yang sudah ada diperbarui (nama, induk, koordinat bila diisi); sebutan hanya ditambah, tidak pernah dihapus.
export async function runImport(text: string): Promise<ImportResult> {
  const { ordered, existing, errors } = await prepareImport(text);
  if (errors.length)
    return {
      ok: false,
      message: `Ada ${errors.length} kesalahan; tidak ada yang diimpor.`,
      errors: errors.slice(0, 100)
    };
  if (!ordered.length) return { ok: false, message: 'Tidak ada baris untuk diimpor.', errors: [] };

  try {
    return await db.transaction(async (tx) => {
      const idBySlug = new Map([...existing].map(([slug, v]) => [slug, v.id]));
      const aliasInserts: { locationId: number; alias: string }[] = [];
      let created = 0;
      let updated = 0;

      for (const level of LEVELS) {
        const group = ordered.filter((r) => r.level === level);
        const parentOf = (r: CsvLocationRow) =>
          r.parentSlug ? (idBySlug.get(r.parentSlug) ?? null) : null;

        for (const r of group.filter((x) => existing.has(x.slug))) {
          const id = existing.get(r.slug)!.id;
          await tx
            .update(locations)
            .set({
              name: r.name,
              ...(r.parentSlug ? { parentId: parentOf(r) } : {}),
              ...(r.lat !== null ? { lat: r.lat, lng: r.lng } : {})
            })
            .where(eq(locations.id, id));
          aliasInserts.push(...r.aliases.map((alias) => ({ locationId: id, alias })));
          updated++;
        }
        for (const part of chunk(
          group.filter((x) => !existing.has(x.slug)),
          500
        )) {
          const ins = await tx
            .insert(locations)
            .values(
              part.map((r) => ({
                slug: r.slug,
                name: r.name,
                level: r.level,
                parentId: parentOf(r),
                lat: r.lat,
                lng: r.lng
              }))
            )
            .returning({ id: locations.id, slug: locations.slug });
          const bySlug = new Map(ins.map((i) => [i.slug, i.id]));
          for (const r of part) {
            const id = bySlug.get(r.slug)!;
            idBySlug.set(r.slug, id);
            aliasInserts.push(...r.aliases.map((alias) => ({ locationId: id, alias })));
          }
          created += part.length;
        }
      }
      for (const part of chunk(aliasInserts, 1000))
        await tx.insert(locationAliases).values(part).onConflictDoNothing();
      return { ok: true as const, created, updated };
    });
  } catch {
    return {
      ok: false,
      message: 'Impor gagal dan dibatalkan; tidak ada data yang berubah.',
      errors: []
    };
  }
}
