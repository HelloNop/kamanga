'use server';
// Uji pencarian untuk admin. Logika pencariannya ada di src/lib/directory (dipakai juga oleh chatbot nanti).
import * as z from 'zod';
import { findProviders } from '@/lib/directory/providers';
import { searchListings, type SearchParams } from '@/lib/directory/search';
import { resolveCategories, resolveLocation } from '@/lib/directory/understand';
import { location, type Region } from '@/lib/engines/contracts';
import { addDays, fromJakarta } from '@/lib/engines/time';
import { requireAdmin } from '@/lib/session';
import type {
  ProviderSearchInput,
  ProviderSearchResponse,
  SearchInput,
  SearchResponse
} from './types';

const inputSchema = z.object({
  q: z.string().max(200).optional(),
  locationText: z.string().max(100).optional(),
  locationId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  budget: z.number().int().positive().max(1_000_000_000).optional(),
  budgetUnit: z.string().max(20).optional(),
  radiusKm: z.number().min(1).max(100).optional(),
  serviceMode: z.enum(['on_site', 'on_call', 'online']).optional(),
  minVerification: z.enum(['contact_checked', 'visited']).optional(),
  minCapacity: z.number().int().positive().max(100000).optional(),
  limit: z.number().int().min(1).max(20).optional()
});

// Kategori hasil kamus/nama yang yakin (>= 0,85) dipakai sebagai saring; yang kurang yakin hanya ikut menilai kata.
const CONFIDENT = 0.85;

export async function runSearch(raw: SearchInput): Promise<SearchResponse> {
  await requireAdmin();
  const input = inputSchema.parse(raw);

  const categories = input.q ? await resolveCategories(input.q) : [];
  const usedCategoryIds = input.categoryId
    ? [input.categoryId]
    : categories.filter((c) => c.confidence >= CONFIDENT).map((c) => c.id);

  let location: SearchResponse['understood']['location'] = null;
  let locationId = input.locationId;
  if (!locationId && input.locationText?.trim()) {
    const r = await resolveLocation(input.locationText);
    location = { text: input.locationText, ...r };
    if (r.best) locationId = r.best.id;
    else if (r.ambiguous) {
      return {
        understood: { categories, usedCategoryIds, location },
        result: null,
        note: 'Nama lokasi bisa berarti lebih dari satu tempat. Pilih salah satu.'
      };
    }
  }
  if (input.locationText?.trim() && !locationId) {
    return {
      understood: { categories, usedCategoryIds, location },
      result: null,
      note: `Lokasi "${input.locationText}" tidak dikenali di gazetteer.`
    };
  }

  const params: SearchParams = {
    q: input.q,
    categoryIds: usedCategoryIds,
    locationId,
    radiusKm: input.radiusKm,
    serviceModes: input.serviceMode ? [input.serviceMode] : undefined,
    minVerification: input.minVerification,
    budget: input.budget ? { max: input.budget, unit: input.budgetUnit || undefined } : undefined,
    attributeFilters: input.minCapacity ? [{ key: 'capacity', min: input.minCapacity }] : undefined,
    limit: input.limit ?? 10
  };
  return {
    understood: { categories, usedCategoryIds, location },
    result: await searchListings(params),
    note: null
  };
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const providerInputSchema = z.object({
  categoryId: z.number().int().positive(),
  place: z.string().max(100).optional(),
  regionId: z.number().int().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  from: hhmm.optional(),
  to: hhmm.optional(),
  seats: z.number().int().min(1).max(50).optional(),
  prefer: z.enum(['visit', 'call']).optional(),
  radiusKm: z.number().min(1).max(100).optional(),
  budgetMax: z.number().int().positive().max(1_000_000_000).optional(),
  sort: z.enum(['score', 'distance']).optional(),
  includePlaces: z.boolean().optional()
});

export async function runProviderSearch(raw: ProviderSearchInput): Promise<ProviderSearchResponse> {
  await requireAdmin();
  const input = providerInputSchema.parse(raw);
  const empty = { region: null, options: [], result: null };

  let region: Region | null = null;
  let regionId = input.regionId;
  if (!regionId && input.place?.trim()) {
    const r = await location.resolvePlaceName(input.place);
    if (r.kind === 'ambiguous')
      return {
        ...empty,
        options: r.options,
        note: 'Nama wilayah bisa berarti beberapa tempat. Pilih salah satu.'
      };
    if (r.kind === 'not_found')
      return { ...empty, note: `Wilayah "${input.place}" tidak dikenali.` };
    region = r.region;
    regionId = r.region.id;
  }

  let when: { from: Date; to: Date } | null = null;
  if (input.date) {
    when = {
      from: fromJakarta(input.date, input.from ?? '00:00'),
      to: input.to
        ? fromJakarta(input.date, input.to)
        : fromJakarta(addDays(input.date, 1), '00:00')
    };
    if (when.to <= when.from)
      return { ...empty, region, note: 'Jam selesai harus setelah jam mulai.' };
  }

  const result = await findProviders({
    categoryIds: [input.categoryId],
    regionId,
    when,
    seats: input.seats,
    prefer: input.prefer,
    radiusKm: input.radiusKm,
    budgetMax: input.budgetMax,
    sort: input.sort,
    providersOnly: !input.includePlaces,
    limit: 20
  });
  return { region, options: [], result, note: null };
}
