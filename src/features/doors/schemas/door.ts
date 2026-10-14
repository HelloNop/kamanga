import * as z from 'zod';
import { Icons } from '@/components/icons';

// Nilai harus sama dengan enum door_status / door_kind di src/db/schema.ts.
export const DOOR_STATUSES = ['active', 'soon', 'hidden'] as const;
export const DOOR_KINDS = ['single', 'plan', 'guide'] as const;
export type DoorStatus = (typeof DOOR_STATUSES)[number];
export type DoorKind = (typeof DOOR_KINDS)[number];

export const DOOR_STATUS_LABELS: Record<DoorStatus, string> = {
  active: 'Aktif',
  soon: 'Segera',
  hidden: 'Tersembunyi'
};
export const DOOR_STATUS_HINTS: Record<DoorStatus, string> = {
  active: 'Tampil di beranda dan bisa dibuka warga',
  soon: 'Tampil di beranda dengan tanda "Segera", belum bisa dibuka',
  hidden: 'Tidak tampil di beranda; kategorinya tetap ditemukan lewat chat'
};
export const DOOR_KIND_LABELS: Record<DoorKind, string> = {
  single: 'Pintu tunggal',
  plan: 'Pintu rencana',
  guide: 'Pintu panduan'
};
export const DOOR_KIND_HINTS: Record<DoorKind, string> = {
  single: 'Satu kebutuhan, satu jenis penyedia (Ka main, Ka servis)',
  plan: 'Menggabungkan beberapa pintu tunggal (Kabaralek)',
  guide: 'Informasi terkurasi, bukan pemesanan (Kabatanyo)'
};

export const ICON_KEYS = Object.keys(Icons) as (keyof typeof Icons)[];
const isIconKey = (v: string) => (ICON_KEYS as string[]).includes(v);

export const doorFormSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(40, 'Maksimal 40 karakter'),
  // Hanya dipakai saat membuat pintu; setelah itu tetap (dipakai alamat /pintu/<slug>).
  slug: z
    .string()
    .trim()
    .max(60)
    .refine(
      (v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
      'Hanya huruf kecil, angka, dan tanda hubung'
    ),
  icon: z.string().refine((v) => v === '' || isIconKey(v), 'Pilih ikon dari daftar'),
  description: z.string().max(200, 'Maksimal 200 karakter'),
  rotatingText: z.string().max(60, 'Maksimal 60 karakter'),
  aliases: z
    .array(z.string().trim().max(40, 'Maksimal 40 karakter per sebutan'))
    .max(20, 'Maksimal 20 sebutan'),
  status: z.enum(DOOR_STATUSES),
  kind: z.enum(DOOR_KINDS)
});

export type DoorFormValues = z.infer<typeof doorFormSchema>;

export const emptyDoorForm: DoorFormValues = {
  name: '',
  slug: '',
  icon: '',
  description: '',
  rotatingText: '',
  aliases: [],
  status: 'hidden',
  kind: 'single'
};

/** Urutan baru setelah `id` digeser satu langkah. null bila tidak bisa digeser (ujung daftar / tidak ada). */
export function moveInOrder(ids: number[], id: number, dir: 'up' | 'down'): number[] | null {
  const i = ids.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
