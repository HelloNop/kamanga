// Logika database pintu. TANPA pemeriksaan login: hanya diimpor oleh service.ts (dan uji).
import { asc, eq, max, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, doors } from '@/db/schema';
import { normAliases } from '@/lib/directory/norm';
import { pgArray } from '@/lib/directory/sql';
import { uniqueSlug } from '@/lib/unique-slug';
import { doorFormSchema, moveInOrder, type DoorFormValues } from '../schemas/door';
import type { DoorDetail, DoorOption, DoorRow, MutationResult } from './types';

const fail = (message: string) => ({ ok: false as const, message });
const ORDER = [asc(doors.sortOrder), asc(doors.id)];

export async function listDoors(): Promise<DoorRow[]> {
  const [rows, cats] = await Promise.all([
    db
      .select()
      .from(doors)
      .orderBy(...ORDER),
    db
      .select({
        id: categories.id,
        name: categories.name,
        isActive: categories.isActive,
        scheduleKind: categories.scheduleKind,
        doorId: categories.doorId
      })
      .from(categories)
      .where(sql`${categories.doorId} is not null`)
      .orderBy(asc(categories.sortOrder), asc(categories.name))
  ]);
  return rows.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    icon: d.icon,
    description: d.description,
    rotatingText: d.rotatingText,
    aliases: d.aliases,
    sortOrder: d.sortOrder,
    status: d.status,
    kind: d.kind,
    categories: cats.filter((c) => c.doorId === d.id).map(({ doorId: _, ...c }) => c)
  }));
}

export async function listDoorOptions(): Promise<DoorOption[]> {
  return db
    .select({ id: doors.id, name: doors.name, status: doors.status })
    .from(doors)
    .orderBy(...ORDER);
}

export async function getDoorDetail(id: number): Promise<DoorDetail | null> {
  const [d] = await db.select().from(doors).where(eq(doors.id, id)).limit(1);
  if (!d) return null;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(categories)
    .where(eq(categories.doorId, id));
  return {
    id: d.id,
    categoryCount: n,
    values: {
      name: d.name,
      slug: d.slug,
      icon: d.icon ?? '',
      description: d.description ?? '',
      rotatingText: d.rotatingText ?? '',
      aliases: d.aliases,
      status: d.status,
      kind: d.kind
    }
  };
}

const toDb = (v: DoorFormValues) => ({
  name: v.name.trim(),
  icon: v.icon || null,
  description: v.description.trim() || null,
  rotatingText: v.rotatingText.trim() || null,
  aliases: normAliases(v.aliases),
  status: v.status,
  kind: v.kind
});

const slugTaken = async (slug: string) =>
  !!(await db.select({ id: doors.id }).from(doors).where(eq(doors.slug, slug)).limit(1))[0];

/** Sebutan lain tidak boleh dipakai pintu lain (chat jadi tidak tahu memilih). */
async function aliasClash(v: DoorFormValues, exceptId?: number) {
  const list = normAliases(v.aliases);
  if (!list.length) return null;
  const rows = await db
    .select({ id: doors.id, name: doors.name, aliases: doors.aliases })
    .from(doors)
    .where(sql`${doors.aliases} && ${pgArray(list, 'text')}`);
  const hit = rows.find((r) => r.id !== exceptId);
  if (!hit) return null;
  return fail(`Sebutan "${hit.aliases.find((a) => list.includes(a))}" sudah dipakai ${hit.name}`);
}

export async function createDoor(input: DoorFormValues): Promise<MutationResult> {
  const parsed = doorFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const v = parsed.data;
  const clash = await aliasClash(v);
  if (clash) return clash;
  if (v.slug && (await slugTaken(v.slug))) return fail('Slug sudah dipakai pintu lain');
  const slug = v.slug || (await uniqueSlug(v.name, slugTaken, 'pintu'));
  // Pintu baru di urutan paling akhir.
  const [{ last }] = await db.select({ last: max(doors.sortOrder) }).from(doors);
  const [row] = await db
    .insert(doors)
    .values({ ...toDb(v), slug, sortOrder: (last ?? 0) + 10 })
    .returning({ id: doors.id });
  return { ok: true, id: row.id };
}

/** Slug tidak diubah: dipakai alamat halaman pintu dan tautan yang sudah tersebar. */
export async function updateDoor(id: number, input: DoorFormValues): Promise<MutationResult> {
  const parsed = doorFormSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Data tidak valid');
  const clash = await aliasClash(parsed.data, id);
  if (clash) return clash;
  const rows = await db
    .update(doors)
    .set(toDb(parsed.data))
    .where(eq(doors.id, id))
    .returning({ id: doors.id });
  return rows.length ? { ok: true, id } : fail('Pintu tidak ditemukan');
}

/** Geser satu langkah, lalu tulis ulang urutan 10, 20, 30, ... (urutan selalu rapi). */
export async function moveDoor(id: number, dir: 'up' | 'down'): Promise<MutationResult> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: doors.id, sortOrder: doors.sortOrder })
      .from(doors)
      .orderBy(...ORDER)
      .for('update');
    const next = moveInOrder(
      rows.map((r) => r.id),
      id,
      dir
    );
    if (!next) return fail(dir === 'up' ? 'Sudah paling atas' : 'Sudah paling bawah');
    for (const [i, doorId] of next.entries()) {
      const sortOrder = (i + 1) * 10;
      if (rows.find((r) => r.id === doorId)?.sortOrder !== sortOrder)
        await tx.update(doors).set({ sortOrder }).where(eq(doors.id, doorId));
    }
    return { ok: true as const, id };
  });
}
