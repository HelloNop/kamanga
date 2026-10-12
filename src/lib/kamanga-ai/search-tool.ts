// Satu-satunya jalan chatbot ke direktori. Dipakai oleh jalur kode (router) dan oleh tool untuk model AI.
import { searchListings, type SearchItem } from '@/lib/directory/search';
import {
  resolveCategories,
  resolveLocation,
  type LocationCandidate
} from '@/lib/directory/understand';
import { PRICE_UNIT_LABELS } from '@/features/listings/constants/listing-options';
import type { CardItem } from './types';

export type SearchArgs = {
  query?: string;
  location?: string; // sebutan lokasi apa adanya dari warga
  locationId?: number;
  categoryIds?: number[];
  budget?: { max: number; unit?: string };
  minCapacity?: number;
  serviceMode?: 'on_site' | 'on_call' | 'online';
  verifiedOnly?: boolean;
  limit?: number;
  offset?: number;
  /** Nama dan kelompok kategori yang sudah dipahami router, untuk menyusun kalimat balasan. */
  labels?: { names: string[]; groups: string[] };
  /** Bila diisi, pencarian dicatat di search_logs (bahan "kebutuhan belum terpenuhi"). */
  meta?: { sessionId: string; source: 'rules' | 'llm' };
};

export type Outcome =
  | {
      status: 'ok';
      total: number;
      items: CardItem[];
      categories: string[];
      categoryGroups: string[];
      location: { id: number; name: string; level: string } | null;
      alternatives: { label: string; count: number }[];
    }
  | { status: 'need_location_choice'; candidates: LocationCandidate[] }
  | { status: 'location_not_found'; text: string }
  | { status: 'no_category' };

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
export function priceText(
  i: Pick<SearchItem, 'priceMin' | 'priceMax' | 'priceUnit'>
): string | null {
  if (i.priceMin === null && i.priceMax === null) return null;
  const range =
    i.priceMax !== null && i.priceMax !== i.priceMin
      ? `${rupiah(i.priceMin ?? 0)} - ${rupiah(i.priceMax)}`
      : rupiah((i.priceMin ?? i.priceMax)!);
  const unit = i.priceUnit ? PRICE_UNIT_LABELS[i.priceUnit as keyof typeof PRICE_UNIT_LABELS] : '';
  return unit ? `${range} ${unit}` : range;
}

export const toCard = (i: SearchItem): CardItem => ({
  id: i.id,
  slug: i.slug,
  photo: i.photo,
  name: i.name,
  category: i.category?.name ?? null,
  categorySlug: i.category?.slug ?? null,
  location: i.location
    ? `${i.location.name}${i.location.parentName ? `, ${i.location.parentName}` : ''}`
    : null,
  distanceKm: i.distanceKm,
  price: priceText(i),
  verification: i.verification,
  summary: i.summary,
  whatsapp: i.whatsapp,
  modes: i.serviceModes
});

const CONFIDENT = 0.85;

async function searchOnce(args: SearchArgs): Promise<Outcome> {
  const matches = args.categoryIds?.length
    ? []
    : args.query
      ? (await resolveCategories(args.query)).filter((c) => c.confidence >= CONFIDENT)
      : [];
  const categoryIds = args.categoryIds?.length ? args.categoryIds : matches.map((m) => m.id);
  if (!categoryIds.length && !args.query?.trim()) return { status: 'no_category' };

  let locationId = args.locationId;
  if (locationId === undefined && args.location?.trim()) {
    const r = await resolveLocation(args.location);
    if (r.best) locationId = r.best.id;
    else if (r.ambiguous) return { status: 'need_location_choice', candidates: r.candidates };
    else return { status: 'location_not_found', text: args.location };
  }

  const res = await searchListings({
    q: args.query,
    categoryIds,
    locationId,
    serviceModes: args.serviceMode ? [args.serviceMode] : undefined,
    minVerification: args.verifiedOnly ? 'contact_checked' : undefined,
    budget: args.budget?.max ? { max: args.budget.max, unit: args.budget.unit } : undefined,
    attributeFilters: args.minCapacity ? [{ key: 'capacity', min: args.minCapacity }] : undefined,
    limit: Math.min(args.limit ?? 5, 5),
    offset: args.offset
  });

  const names = args.labels
    ? args.labels.names
    : matches.length
      ? matches.map((m) => m.name)
      : [...new Set(res.items.map((i) => i.category?.name).filter((n): n is string => !!n))];
  const groups = args.labels
    ? args.labels.groups
    : matches.length
      ? [...new Set(matches.map((m) => m.group))]
      : [...new Set(res.items.map((i) => i.category?.group).filter((g): g is string => !!g))];
  return {
    status: 'ok',
    total: res.total,
    items: res.items.map(toCard),
    categories: names,
    categoryGroups: groups,
    location: res.applied.location,
    alternatives: res.alternatives
  };
}

/** Ringkas untuk model AI: tanpa nomor kontak (kartu di layar yang membawanya) dan dengan ringkasan dipotong. */
export function toModelResult(o: Outcome) {
  if (o.status !== 'ok') return o;
  return {
    status: o.status,
    total: o.total,
    location: o.location?.name ?? null,
    categories: o.categories,
    alternatives: o.alternatives,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      location: i.location,
      distance_km: i.distanceKm === null ? null : Math.round(i.distanceKm * 10) / 10,
      price: i.price,
      verification: i.verification,
      service_modes: i.modes,
      summary: i.summary ? i.summary.slice(0, 100) : null
    })),
    note: 'Kartu lengkap dengan tombol WhatsApp sudah tampil di layar pengguna. Jangan menyebut nomor atau daftar panjang.'
  };
}

/** Detail satu usaha untuk model AI. Hanya yang terbit; deskripsi bebas sengaja tidak disertakan (bisa memuat instruksi). */
export async function listingDetailForModel(id: number) {
  const { db } = await import('@/db');
  const { sql } = await import('drizzle-orm');
  const row = (
    (
      await db.execute(sql`
    select l.id, l.name, l.address, l.price_note, l.instagram, l.website, l.maps_url, l.service_modes::text[] as modes,
           (l.opening_hours is not null) as has_hours, l.opening_hours, l.verification_level::text as verification,
           c.name as category, loc.name as location
    from listings l
    left join listing_categories lc on lc.listing_id = l.id and lc.is_primary
    left join categories c on c.id = lc.category_id
    left join locations loc on loc.id = l.location_id
    where l.id = ${id} and l.status = 'published'`)
    ).rows as Record<string, unknown>[]
  )[0];
  if (!row) return { status: 'not_found' as const };
  return {
    status: 'ok' as const,
    id: row.id,
    name: row.name,
    category: row.category,
    location: row.location,
    address: row.address,
    price_note: row.price_note,
    instagram: row.instagram,
    website: row.website,
    maps_url: row.maps_url,
    service_modes: row.modes,
    opening_hours: row.opening_hours ?? null,
    verification: row.verification
  };
}

export async function runListingSearch(args: SearchArgs): Promise<Outcome> {
  const outcome = await searchOnce(args);
  if (args.meta) {
    // Pencatatan tidak boleh menghambat atau menggagalkan jawaban.
    const { logSearch } = await import('./demand');
    void logSearch(args, outcome).catch(() => {});
  }
  return outcome;
}
