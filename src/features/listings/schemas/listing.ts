import * as z from 'zod';
import { isHttpUrl, normalizeWhatsapp } from '../lib/format';
import {
  PRICE_UNITS,
  SERVICE_MODES,
  SOURCES,
  STATUSES,
  VERIFICATIONS
} from '../constants/listing-options';

const optionalUrl = (label: string) =>
  z
    .string()
    .max(500)
    .refine((v) => !v.trim() || isHttpUrl(v), `${label} harus diawali http:// atau https://`);

// Dipakai di formulir (klien) DAN divalidasi ulang di server. Nilai pilihan berupa string; angka diubah di server.
export const listingFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(120, 'Maksimal 120 karakter'),
    slug: z
      .string()
      .trim()
      .max(80)
      .refine(
        (v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
        'Hanya huruf kecil, angka, dan tanda hubung'
      ),
    summary: z.string().max(200, 'Maksimal 200 karakter'),
    description: z.string().max(5000, 'Maksimal 5000 karakter'),

    // provider: bisa dipesan; place: informasi saja (kafe, wisata, apotek 24 jam, IGD).
    kind: z.enum(['provider', 'place']),
    primaryCategoryId: z.string().min(1, 'Pilih kategori utama'),
    extraCategoryIds: z.array(z.string()),

    serviceModes: z.array(z.enum(SERVICE_MODES)).min(1, 'Pilih minimal satu cara layanan'),
    locationId: z.string(), // '' = kosong
    address: z.string().max(300),
    lat: z.number().min(-90, 'Lat -90 sampai 90').max(90, 'Lat -90 sampai 90').optional(),
    lng: z.number().min(-180, 'Lng -180 sampai 180').max(180, 'Lng -180 sampai 180').optional(),
    areaIds: z.array(z.string()),
    // false = usaha rumahan: publik hanya melihat kecamatan.
    pointIsPublic: z.boolean(),
    serviceRadiusKm: z
      .number()
      .positive('Radius harus lebih dari 0')
      .max(200, 'Maksimal 200 km')
      .optional(),

    whatsapp: z
      .string()
      .refine((v) => !v.trim() || normalizeWhatsapp(v) !== null, 'Nomor WhatsApp tidak valid'),
    phone: z.string().max(30),
    instagram: z.string().max(100),
    website: optionalUrl('Website'),
    mapsUrl: optionalUrl('Tautan peta'),

    priceMin: z.number().int('Harus bilangan bulat').min(0, 'Tidak boleh negatif').optional(),
    priceMax: z.number().int('Harus bilangan bulat').min(0, 'Tidak boleh negatif').optional(),
    priceUnit: z.union([z.enum(PRICE_UNITS), z.literal('')]),
    priceNote: z.string().max(300),

    attributes: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional()
    ),
    keywords: z.array(z.string().max(60)),

    status: z.enum(STATUSES),
    reviewNote: z.string().max(500),
    verificationLevel: z.enum(VERIFICATIONS),
    source: z.enum(SOURCES),
    sourceUrl: z.string().max(500)
  })
  .superRefine((v, ctx) => {
    if ((v.lat === undefined) !== (v.lng === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['lat'],
        message: 'Isi lat dan lng bersamaan, atau kosongkan keduanya'
      });
    }
    if (v.priceMin !== undefined && v.priceMax !== undefined && v.priceMin > v.priceMax) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMax'],
        message: 'Harga maksimum harus sama atau lebih besar dari minimum'
      });
    }
    if (v.status === 'rejected' && !v.reviewNote.trim()) {
      ctx.addIssue({ code: 'custom', path: ['reviewNote'], message: 'Isi alasan penolakan' });
    }
  });

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export const emptyListingForm: ListingFormValues = {
  name: '',
  slug: '',
  summary: '',
  description: '',
  kind: 'provider',
  primaryCategoryId: '',
  extraCategoryIds: [],
  serviceModes: ['on_site'],
  locationId: '',
  address: '',
  lat: undefined,
  lng: undefined,
  areaIds: [],
  pointIsPublic: true,
  serviceRadiusKm: undefined,
  whatsapp: '',
  phone: '',
  instagram: '',
  website: '',
  mapsUrl: '',
  priceMin: undefined,
  priceMax: undefined,
  priceUnit: '',
  priceNote: '',
  attributes: {},
  keywords: [],
  status: 'draft',
  reviewNote: '',
  verificationLevel: 'unverified',
  source: 'team',
  sourceUrl: ''
};
