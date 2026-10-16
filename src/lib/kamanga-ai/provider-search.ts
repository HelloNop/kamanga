// Niat → Mesin (PRD 8.2, 8.3): niat terstruktur dari sesi diteruskan ke findProviders (Jadwal + Lokasi), lalu
// kartu hasil disusun KODE dari database. Teks balasan juga dari kode; AI tidak menyebut penyedia, harga, atau jadwal.
import { findProviders, type ProviderCard, type ProviderQuery } from '@/lib/directory/providers';
import { paths, type Point, type Slot } from '@/lib/engines/contracts';
import { formatClock, formatDay, formatSlot, jakartaDate } from '@/lib/engines/time';
import { VERIFICATION_LABELS } from '@/features/listings/constants/listing-options';
import { formatRupiah } from '@/features/listings/lib/format';
import { whenLabel, whenRange } from './extract';
import { priceText } from './search-tool';
import type { ChatState, Chip, ProviderItem, Reply } from './types';

/** "Lapangan Padel" → "lapangan padel", "Servis AC" → "servis AC". */
const lower = (s: string) =>
  s
    .split(' ')
    .map((w) => (/^[A-Z][a-z]/.test(w) ? w.toLowerCase() : w))
    .join(' ');
const joinNames = (a: string[]) =>
  a.length <= 1 ? (a[0] ?? '') : `${a.slice(0, -1).join(', ')} dan ${a.at(-1)}`;

/** Slot kosong untuk tombol: satu tombol per jam mulai (unit pertama yang kosong). */
function slotButtons(card: ProviderCard, seats: number | undefined) {
  const byStart = new Map<number, Slot>();
  for (const s of card.slots)
    if (!byStart.has(s.startsAt.getTime())) byStart.set(s.startsAt.getTime(), s);
  const slots = [...byStart.values()];
  const days = new Set(slots.map((s) => jakartaDate(s.startsAt)));
  const seat = card.category.scheduleKind === 'seat';
  return {
    slotDay: days.size === 1 ? formatDay(slots[0].startsAt) : null,
    slots: slots.map((s) => ({
      time:
        days.size === 1
          ? formatClock(s.startsAt)
          : `${formatDay(s.startsAt).slice(0, 3)} ${formatClock(s.startsAt)}`,
      price:
        [s.price === null ? null : formatRupiah(s.price), seat ? `sisa ${s.seatsLeft}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      href: paths.bookingStart(card.slug, {
        unitId: s.unitId,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        seats
      }),
      title: formatSlot(s.startsAt, s.endsAt)
    }))
  };
}

const MISSING: Record<string, string> = {
  harga: 'harga',
  lokasi: 'titik lokasi',
  jadwal: 'jadwal'
};

function toItem(c: ProviderCard, seats: number | undefined, labels: Record<string, string>) {
  const timed = c.category.scheduleKind === 'slot' || c.category.scheduleKind === 'seat';
  const { slotDay, slots } =
    c.bookable && timed ? slotButtons(c, seats) : { slotDay: null, slots: [] };
  const missing = c.missing.map((m) => MISSING[m] ?? labels[m] ?? m);
  const item: ProviderItem = {
    id: c.id,
    slug: c.slug,
    name: c.name,
    category: c.category.name,
    place: c.place,
    distance: c.distanceLabel,
    verification:
      c.verification === 'unverified'
        ? null
        : VERIFICATION_LABELS[c.verification as keyof typeof VERIFICATION_LABELS],
    rating: c.rating ? `${c.rating.satisfied} dari ${c.rating.count} puas` : null,
    price: priceText({ priceMin: c.price.min, priceMax: c.price.max, priceUnit: c.price.unit }),
    photo: c.photo,
    profileHref: paths.listing(c.slug),
    bookHref: c.bookable && c.category.scheduleKind === 'none' ? paths.bookingStart(c.slug) : null,
    mapsUrl: c.kind === 'place' ? (c.info?.mapsUrl ?? null) : null,
    slotDay,
    slots,
    note: missing.length
      ? `Data ${missing.join(', ')} belum ada`
      : c.kind === 'provider' && !c.bookable
        ? 'Belum bisa dipesan lewat Kamanga'
        : null
  };
  return item;
}

export type ProviderSearchResult = {
  reply: Reply;
  shown: { id: number; slug: string; name: string }[];
  total: number;
  relaxCount: number;
};

/**
 * Jalankan niat sesi lewat findProviders. `origin` = titik perangkat untuk pencarian ini saja (tidak disimpan).
 * `attributeLabels` = label isian aturan kategori, untuk menulis pelonggaran dengan bahasa warga.
 */
export async function searchProviders(
  s: ChatState,
  opts: {
    origin?: Point | null;
    now: Date;
    scheduleKind: string;
    attributeLabels?: Record<string, string>;
  }
): Promise<ProviderSearchResult> {
  const labels = opts.attributeLabels ?? {};
  const q: ProviderQuery = {
    categoryIds: (s.categories ?? []).map((c) => c.id),
    // Travel dicocokkan dengan rute, bukan jarak dari warga.
    origin: s.route ? null : (opts.origin ?? null),
    regionId: s.route || opts.origin ? null : (s.region?.id ?? null),
    prefer: s.prefer ?? undefined,
    when: s.when ? whenRange(s.when) : null,
    seats: s.people ?? undefined,
    route: s.route ? { fromId: s.route.fromId, toId: s.route.toId } : null,
    radiusKm: s.radiusKm ?? undefined,
    budgetMax: s.budget?.max ?? null,
    attributes: s.attributes && Object.keys(s.attributes).length ? s.attributes : undefined,
    limit: 5,
    slotsPerListing: 12
  };
  const res = await findProviders(q);
  const seats = s.people ?? undefined;
  const items = res.items.map((c) => toItem(c, seats, labels));
  const uncertain = res.uncertain.map((c) => toItem(c, seats, labels));

  const what = lower(joinNames((s.categories ?? []).map((c) => c.name)));
  const timed = opts.scheduleKind === 'slot' || opts.scheduleKind === 'seat';
  const when = s.when ? ` ${whenLabel(s.when, opts.now)}` : '';
  const where = s.route
    ? ` ${s.route.fromName} ke ${s.route.toName}`
    : s.region
      ? ` dekat ${s.region.label}`
      : '';
  const people = s.people && timed ? `, untuk ${s.people} orang` : '';
  const conditions = Object.keys(s.attributes ?? {}).map((k) => lower(labels[k] ?? k));
  const withRule = conditions.length ? ` yang ${conditions.join(' dan ')}` : '';
  const located = s.region?.source === 'device' ? `Lokasi: ${s.region.label}. ` : '';

  let text: string;
  if (items.length) {
    text = timed
      ? `${located}Ini ${what}${withRule} yang masih ada jadwal kosong${when}${where}${people}. Pilih jam untuk memesan.`
      : `${located}Ini ${what}${withRule} yang melayani${where.replace(' dekat', '')}. Tekan Pesan untuk mengirim permintaan.`;
  } else {
    text = `${located}Belum ada ${what}${withRule}${timed ? ' yang kosong' : ''}${when}${where}.`;
    if (res.relaxations.length) text += ' Mau dilonggarkan?';
  }
  if (uncertain.length)
    text +=
      ' Beberapa tempat datanya belum lengkap, jadi ditampilkan terpisah sebagai "belum pasti".';

  const relaxLabel = (key: string, label: string) =>
    key === 'attributes' && conditions.length ? `abaikan syarat ${conditions.join(', ')}` : label;
  const chips: Chip[] = res.relaxations.map((r) => ({
    label: `${relaxLabel(r.key, r.label).replace(/^./, (c) => c.toUpperCase())} (${r.count} hasil)`,
    action: { kind: 'relax', key: r.key }
  }));
  if (s.region?.source === 'device') chips.push({ label: 'Ganti lokasi' });

  return {
    reply: {
      text,
      chips,
      providers:
        items.length || uncertain.length ? { items, uncertain, total: res.total } : undefined
    },
    shown: [...items, ...uncertain].map((i) => ({ id: i.id, slug: i.slug, name: i.name })),
    total: res.total,
    relaxCount: Math.max(0, ...res.relaxations.map((r) => r.count))
  };
}
