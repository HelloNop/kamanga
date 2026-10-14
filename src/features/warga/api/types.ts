// Bentuk data antara halaman warga (klien) dan server action. Hanya impor tipe agar aman di klien.
import type { Relaxation } from '@/lib/directory/providers';
import type { Point, ServicePeriod } from '@/lib/engines/contracts';

/**
 * Pilihan lokasi warga. Disimpan hanya di sessionStorage peramban (bukan di server, bukan di URL).
 * device: titik perangkat (dipakai untuk mencari saat itu, tidak disimpan server).
 * place: wilayah yang diketik. saved: alamat tersimpan milik warga (titiknya dibaca di server).
 */
export type LocChoice =
  | { source: 'device'; point: Point; label: string }
  | { source: 'place'; regionId: number; label: string }
  | { source: 'saved'; addressId: number; label: string };

export type SavedAddressOption = { id: number; label: string; address: string };

export type SearchInput = {
  categoryId: number;
  loc: LocChoice | null;
  date: string;
  period: ServicePeriod | 'semua';
  seats: number;
  destinationId: number | null;
  /** Pelonggaran yang DIPILIH warga (PRD 8.3). */
  relax: { radius?: boolean; time?: boolean };
};

export type ResultSlot = {
  day: string;
  time: string;
  price: string | null;
  note: string | null;
  href: string;
};

export type ResultCard = {
  id: number;
  name: string;
  category: string;
  place: string | null;
  distance: string | null;
  verification: string;
  verified: boolean;
  rating: string | null;
  price: string | null;
  href: string;
  /** Kategori tanpa jadwal: tombol "Pesan". */
  bookHref: string | null;
  bookable: boolean;
  slots: ResultSlot[];
  missing: string[];
};

export type SearchResult =
  | {
      ok: true;
      items: ResultCard[];
      uncertain: ResultCard[];
      relaxations: Pick<Relaxation, 'key' | 'label' | 'count'>[];
      locationLabel: string | null;
    }
  | { ok: false; error: string };

export type PlaceResult =
  | { kind: 'resolved'; regionId: number; label: string }
  | { kind: 'ambiguous'; options: { regionId: number; label: string }[] }
  | { kind: 'not_found' };

export type PointResult = { ok: true; label: string } | { ok: false; error: string };

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
