import * as z from 'zod';
import { LEVELS } from '../constants';

export const locationFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Maksimal 100 karakter'),
    slug: z
      .string()
      .trim()
      .max(80)
      .refine(
        (v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
        'Hanya huruf kecil, angka, dan tanda hubung'
      ),
    level: z.enum(LEVELS),
    parentId: z.string(), // '' = tanpa induk
    lat: z.number().min(-90, 'Lat -90 sampai 90').max(90, 'Lat -90 sampai 90').optional(),
    lng: z.number().min(-180, 'Lng -180 sampai 180').max(180, 'Lng -180 sampai 180').optional(),
    aliases: z
      .array(z.string().trim().max(80, 'Maksimal 80 karakter per sebutan'))
      .max(30, 'Maksimal 30 sebutan')
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'Isi lat dan lng bersamaan, atau kosongkan keduanya'
      });
    }
    if (v.level === 'province' && v.parentId) {
      ctx.addIssue({
        code: 'custom',
        path: ['parentId'],
        message: 'Provinsi tidak boleh punya induk'
      });
    }
  });

export type LocationFormValues = z.infer<typeof locationFormSchema>;

export const emptyLocationForm: LocationFormValues = {
  name: '',
  slug: '',
  level: 'district',
  parentId: '',
  lat: undefined,
  lng: undefined,
  aliases: []
};
