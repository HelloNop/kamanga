'use server';

// Server action PUBLIK (tamu boleh menjelajah, PRD §4): mengenali lokasi dan mencari penyedia di halaman pintu.
// Masukan diperiksa Zod. Koordinat perangkat hanya dipakai untuk menghitung: tidak disimpan, tidak dicatat,
// dan tidak pernah dikirim lewat URL. Alamat tersimpan hanya dibaca bila pemiliknya sedang masuk.
import { z } from 'zod';
import { findProviders, type ProviderCard } from '@/lib/directory/providers';
import { location, paths, type Point, type Region } from '@/lib/engines/contracts';
import { addDays, fromJakarta } from '@/lib/engines/time';
import { getSession } from '@/lib/session';
import { periodWindow, priceLabel, VERIFICATION_TEXT } from '../lib/format';
import { slotButtons } from '../lib/slots';
import { getCategoryForSearch, listSavedAddresses, unitNames } from './repository';
import type { PlaceResult, PointResult, ResultCard, SearchResult } from './types';
import { locSchema, pointSchema, whereOf } from './where';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const searchSchema = z.object({
  categoryId: z.number().int().positive(),
  loc: locSchema.nullable(),
  date: day,
  period: z.enum(['pagi', 'siang', 'sore', 'malam', 'semua']),
  seats: z.number().int().min(1).max(50),
  destinationId: z.number().int().positive().nullable(),
  relax: z.object({ radius: z.boolean().optional(), time: z.boolean().optional() })
});

const OUTSIDE =
  'Lokasimu di luar wilayah layanan Kamanga (sementara baru Kota Padang). Ketik nama daerah tempat layanan.';

/** Titik perangkat → "Kuranji, Padang". Dipanggil setelah warga menekan "Pakai lokasi saya". */
export async function resolveDevicePoint(p: Point): Promise<PointResult> {
  const parsed = pointSchema.safeParse(p);
  if (!parsed.success) return { ok: false, error: 'Lokasi tidak terbaca. Ketik nama daerah saja.' };
  const r = await location.resolvePoint(parsed.data);
  if (!r?.inServiceRegion) return { ok: false, error: OUTSIDE };
  return { ok: true, label: r.label };
}

const regionLabel = (g: Region) =>
  [g.name, g.parentName]
    .filter(Boolean)
    .join(', ')
    .replace(/^Kota /, '');

/** Nama daerah yang diketik → wilayah. Ambigu hanya bila tetap ambigu setelah konteks dipakai. */
export async function resolvePlace(text: string): Promise<PlaceResult> {
  const t = String(text ?? '')
    .trim()
    .slice(0, 80);
  if (t.length < 2) return { kind: 'not_found' };
  const session = await getSession();
  const saved =
    session?.user.role === 'citizen'
      ? (await listSavedAddresses(session.user.id))
          .map((a) => a.locationId)
          .filter((id): id is number => id !== null)
      : [];
  const r = await location.resolvePlaceName(t, { savedLocationIds: saved });
  if (r.kind === 'resolved')
    return { kind: 'resolved', regionId: r.region.id, label: regionLabel(r.region) };
  if (r.kind === 'ambiguous')
    return {
      kind: 'ambiguous',
      options: r.options.map((o) => ({ regionId: o.id, label: regionLabel(o) }))
    };
  return { kind: 'not_found' };
}

const MISSING: Record<string, string> = {
  harga: 'harga belum diisi',
  lokasi: 'titik lokasi belum ada',
  jadwal: 'jadwal belum diisi'
};

/** Cari penyedia untuk satu kategori pintu (PRD 9.1–9.3). Urut terdekat; pelonggaran hanya bila dipilih. */
export async function searchDoor(raw: unknown): Promise<SearchResult> {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Isian belum lengkap. Periksa lagi.' };
  const q = parsed.data;
  const cat = await getCategoryForSearch(q.categoryId);
  if (!cat || cat.doorStatus !== 'active')
    return { ok: false, error: 'Jenis layanan ini belum dibuka.' };
  const where = await whereOf(q.loc);
  if (where.error) return { ok: false, error: where.error };
  const kind = cat.scheduleKind;
  if (kind !== 'slot' && !where.origin && !where.regionId)
    return { ok: false, error: 'Pilih lokasi dulu supaya kami carikan yang melayani daerahmu.' };

  const timed = kind === 'slot' || kind === 'seat';
  const when = !timed
    ? null
    : q.relax.time
      ? { from: fromJakarta(q.date, '00:00'), to: fromJakarta(addDays(q.date, 2), '00:00') }
      : periodWindow(q.date, q.period);
  let route: { fromId: number; toId: number } | null = null;
  if (kind === 'seat') {
    if (!q.destinationId) return { ok: false, error: 'Pilih kota tujuan dulu.' };
    const [fromId] = await location.serviceRegionIds();
    route = { fromId, toId: q.destinationId };
  }

  const res = await findProviders({
    categoryIds: [cat.id],
    origin: where.origin ?? null,
    regionId: where.regionId ?? null,
    // Penyedia datang ke warga untuk servis dan jemput travel (PRD 8.15).
    prefer: kind === 'slot' ? undefined : 'call',
    when,
    seats: q.seats,
    route,
    // ponytail: satu tingkat pelonggaran jarak (15 km bawaan findProviders × 3).
    radiusKm: q.relax.radius ? 45 : undefined,
    sort: 'distance',
    limit: 20,
    slotsPerListing: 30
  });

  const names = await unitNames([
    ...new Set([...res.items, ...res.uncertain].flatMap((c) => c.slots.map((s) => s.unitId)))
  ]);
  const toCard = (c: ProviderCard): ResultCard => {
    const seat = c.category.scheduleKind === 'seat';
    return {
      id: c.id,
      name: c.name,
      category: c.category.name,
      place: c.place,
      distance: c.distanceLabel,
      verification: VERIFICATION_TEXT[c.verification] ?? c.verification,
      verified: c.verification !== 'unverified',
      rating: c.rating ? `${c.rating.satisfied} dari ${c.rating.count} ulasan puas` : null,
      price: priceLabel(c.price.min, c.price.max, c.price.unit),
      href: paths.listing(c.slug),
      bookHref: c.bookable && !timed ? paths.bookingStart(c.slug) : null,
      bookable: c.bookable,
      slots: c.bookable ? slotButtons(c.slug, c.slots, names, { seat, seats: q.seats }) : [],
      missing: c.missing.map((m) => MISSING[m] ?? m)
    };
  };

  const locationLabel = q.loc?.label ?? null;
  return {
    ok: true,
    items: res.items.map(toCard),
    uncertain: res.uncertain.map(toCard),
    // Hanya pelonggaran yang bisa dipakai halaman pintu dan belum dipilih.
    relaxations: res.relaxations
      .filter((r) => (r.key === 'radius' && !q.relax.radius) || (r.key === 'time' && !q.relax.time))
      .map(({ key, label, count }) => ({ key, label, count })),
    locationLabel
  };
}
