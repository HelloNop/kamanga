import * as z from 'zod';

export const needFormSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80, 'Maksimal 80 karakter'),
  slug: z
    .string()
    .trim()
    .max(80)
    .refine(
      (v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
      'Hanya huruf kecil, angka, dan tanda hubung'
    ),
  description: z.string().max(500, 'Maksimal 500 karakter'),
  // Sebutan lain yang dikenali chatbot, mis. "baralek" untuk Pesta Pernikahan.
  aliases: z
    .array(z.string().trim().max(40, 'Maksimal 40 karakter per sebutan'))
    .max(20, 'Maksimal 20 sebutan'),
  // Kategori yang dicarikan untuk kebutuhan ini, urut dari yang paling utama.
  categoryIds: z
    .array(z.string())
    .min(1, 'Pilih minimal satu kategori')
    .max(20, 'Maksimal 20 kategori'),
  sortOrder: z.number({ error: 'Wajib diisi' }).int('Bilangan bulat').min(0).max(9999),
  isActive: z.boolean()
});

export type NeedFormValues = z.infer<typeof needFormSchema>;

export const emptyNeedForm: NeedFormValues = {
  name: '',
  slug: '',
  description: '',
  aliases: [],
  categoryIds: [],
  sortOrder: 0,
  isActive: true
};
