import * as z from 'zod';
import { ATTRIBUTE_TYPES, hasOptions } from '@/features/listings/lib/format';
import { SCHEDULE_KINDS } from '../constants';

export const attributeDefSchema = z.object({
  // Kosong untuk isian baru: server membuatnya dari label. Isian lama mempertahankan kuncinya.
  key: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^[a-z][a-z0-9_]{0,29}$/.test(v),
      'Huruf kecil, angka, garis bawah; diawali huruf'
    ),
  label: z.string().trim().min(1, 'Wajib diisi').max(60, 'Maksimal 60 karakter'),
  type: z.enum(ATTRIBUTE_TYPES),
  // Daftar pilihan; hanya dipakai untuk tipe Pilihan dan Pilihan ganda.
  options: z
    .array(z.string().trim().min(1).max(40, 'Maksimal 40 karakter'))
    .max(20, 'Maksimal 20 pilihan')
});

export const groupNameSchema = z
  .string()
  .trim()
  .min(2, 'Nama minimal 2 karakter')
  .max(40, 'Maksimal 40 karakter');

export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Maksimal 80 karakter'),
    slug: z
      .string()
      .trim()
      .max(80)
      .refine(
        (v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
        'Hanya huruf kecil, angka, dan tanda hubung'
      ),
    // Kelompok dipilih dari daftar; kelompok baru dibuat lewat modal "Tambah kelompok".
    groupId: z.number({ error: 'Pilih kelompok' }).int().min(1, 'Pilih kelompok'),
    extraGroupIds: z.array(z.number().int().min(1)).max(5, 'Maksimal 5 kelompok tambahan'),
    // Sebutan lain yang dikenali chatbot, mis. "onda" untuk Servis Motor.
    aliases: z
      .array(z.string().trim().max(40, 'Maksimal 40 karakter per sebutan'))
      .max(20, 'Maksimal 20 sebutan'),
    needsLocation: z.boolean(),
    infoOnly: z.boolean(),
    description: z.string().max(500, 'Maksimal 500 karakter'),
    sortOrder: z.number({ error: 'Wajib diisi' }).int('Bilangan bulat').min(0).max(9999),
    isActive: z.boolean(),
    attributes: z.array(attributeDefSchema).max(15, 'Maksimal 15 isian'),
    // Pintu utama ('' = tanpa pintu, tetap ditemukan lewat chat).
    doorId: z.string(),
    scheduleKind: z.enum(SCHEDULE_KINDS),
    // Batas waktu penyedia menjawab pesanan. Kosong = bawaan di Pengaturan.
    responseMinutes: z
      .number()
      .int('Bilangan bulat')
      .min(5, 'Minimal 5 menit')
      .max(1440, 'Maksimal 1440 menit (24 jam)')
      .optional()
  })
  .superRefine((v, ctx) => {
    const keys = new Set<string>();
    const labels = new Set<string>();
    v.attributes.forEach((a, i) => {
      if (a.key && keys.has(a.key))
        ctx.addIssue({ code: 'custom', path: ['attributes', i, 'key'], message: 'Kode ganda' });
      keys.add(a.key);
      const l = a.label.toLowerCase();
      if (labels.has(l))
        ctx.addIssue({
          code: 'custom',
          path: ['attributes', i, 'label'],
          message: 'Nama isian sudah ada'
        });
      labels.add(l);
      if (hasOptions(a.type)) {
        const uniq = new Set(a.options.map((o) => o.toLowerCase()));
        if (uniq.size < 2)
          ctx.addIssue({
            code: 'custom',
            path: ['attributes', i, 'options'],
            message: 'Isi minimal 2 pilihan'
          });
        else if (uniq.size !== a.options.length)
          ctx.addIssue({
            code: 'custom',
            path: ['attributes', i, 'options'],
            message: 'Ada pilihan yang sama'
          });
      }
    });
  });

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const emptyCategoryForm: CategoryFormValues = {
  name: '',
  slug: '',
  groupId: 0,
  extraGroupIds: [],
  aliases: [],
  needsLocation: true,
  infoOnly: false,
  description: '',
  sortOrder: 0,
  isActive: true,
  attributes: [],
  doorId: '',
  scheduleKind: 'none',
  responseMinutes: undefined
};
