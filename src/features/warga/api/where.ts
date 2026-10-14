// Lokasi pilihan warga untuk pencarian dan pesanan (dipakai search.ts dan service.ts; bukan server action).
import { z } from 'zod';
import type { Point } from '@/lib/engines/contracts';
import { getSession } from '@/lib/session';
import { getSavedAddress } from './repository';
import type { LocChoice } from './types';

export const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
const label = z.string().max(200);
export const locSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('device'), point: pointSchema, label }),
  z.object({ source: z.literal('place'), regionId: z.number().int().positive(), label }),
  z.object({ source: z.literal('saved'), addressId: z.number().int().positive(), label })
]);

export type Where = {
  /** Titik untuk jarak/area layanan: perangkat (tidak disimpan) atau alamat tersimpan. */
  origin?: Point;
  /** Wilayah yang diketik (titik tengahnya dipakai bila tanpa titik). */
  regionId?: number;
  /** Alamat tersimpan milik warga yang sedang masuk. */
  saved?: { address: string; point: Point | null; locationId: number | null };
  error?: string;
};

/** Lokasi pilihan warga → titik atau wilayah. Alamat tersimpan hanya untuk pemiliknya. */
export async function whereOf(loc: LocChoice | null): Promise<Where> {
  if (!loc) return {};
  if (loc.source === 'device') return { origin: loc.point };
  if (loc.source === 'place') return { regionId: loc.regionId };
  const session = await getSession();
  const a =
    session?.user.role === 'citizen' ? await getSavedAddress(session.user.id, loc.addressId) : null;
  if (!a) return { error: 'Alamat tersimpan tidak ditemukan. Pilih lokasi lagi.' };
  const point = a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : null;
  return {
    origin: point ?? undefined,
    regionId: point ? undefined : (a.locationId ?? undefined),
    saved: { address: a.address, point, locationId: a.locationId }
  };
}
