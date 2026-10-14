// Tombol slot kosong untuk halaman pintu, pesan, dan profil (server saja: memakai paths dari kontrak mesin).
import { paths, type Slot } from '@/lib/engines/contracts';
import { formatClock, formatDay } from '@/lib/engines/time';
import type { ResultSlot } from '../api/types';
import { rupiah } from './format';

/**
 * Slot berjam sama di beberapa unit (Lapangan 1, 2, 3) digabung jadi satu tombol (unit pertama yang kosong).
 * Kursi travel tidak digabung karena tiap unit adalah kendaraan/rute sendiri.
 */
export function slotButtons(
  slug: string,
  slots: Slot[],
  names: Map<number, string>,
  opts: { seat: boolean; seats: number; max?: number }
): ResultSlot[] {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const k = opts.seat ? `${s.unitId}|${s.startsAt.getTime()}` : String(s.startsAt.getTime());
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return [...groups.values()].slice(0, opts.max ?? 8).map(([s, ...more]) => ({
    day: formatDay(s.startsAt),
    time: `${formatClock(s.startsAt)}–${formatClock(s.endsAt)}`,
    price: s.price === null ? null : `${rupiah(s.price)}${opts.seat ? '/orang' : ''}`,
    note: more.length
      ? `${more.length + 1} pilihan kosong`
      : [names.get(s.unitId), opts.seat ? `sisa ${s.seatsLeft} kursi` : null]
          .filter(Boolean)
          .join(' · ') || null,
    href: paths.bookingStart(slug, {
      unitId: s.unitId,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      seats: opts.seats
    })
  }));
}
