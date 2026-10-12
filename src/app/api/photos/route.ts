// Foto listing: unggah, hapus, jadikan sampul. Admin langsung tampil; kiriman vendor masuk
// `pendingPhotos` dan baru tampil setelah disetujui tim (lihat reviewListing).
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '@/db';
import { listings } from '@/db/schema';
import { MAX_PHOTOS } from '@/features/listings/constants/listing-options';
import { sameOrigin } from '@/lib/kamanga-ai/request';
import { getSession } from '@/lib/session';
import { deletePhoto, photoUrl, putPhoto, storageReady } from '@/lib/storage';

const MAX_BYTES = 5 * 1024 * 1024;

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (message: string, status = 400) => json({ ok: false, message }, status);

/** Listing yang boleh diubah pemanggil: admin semuanya, vendor hanya miliknya. */
async function access(listingId: number) {
  const session = await getSession();
  const role = session?.user.role;
  if (!session || (role !== 'admin' && role !== 'vendor')) return null;
  const [l] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!l || (role === 'vendor' && l.ownerId !== session.user.id)) return null;
  return { l, admin: role === 'admin' };
}

const view = (photos: string[], pending: string[]) => ({
  ok: true,
  photos: photos.map((key) => ({ key, url: photoUrl(key) })),
  pending: pending.map((key) => ({ key, url: photoUrl(key) }))
});

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Permintaan ditolak', 403);
  if (!storageReady()) return fail('Penyimpanan foto belum diatur', 503);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const ctx = await access(Number(form?.get('listingId')));
  if (!ctx) return fail('Listing tidak ditemukan', 404);
  if (!(file instanceof File)) return fail('Pilih foto dulu');
  if (file.size > MAX_BYTES) return fail('Foto terlalu besar (maksimal 5 MB)');
  const { l, admin } = ctx;
  if (l.photos.length + l.pendingPhotos.length >= MAX_PHOTOS)
    return fail(`Maksimal ${MAX_PHOTOS} foto per listing`);

  let out: Buffer;
  try {
    const img = sharp(Buffer.from(await file.arrayBuffer()));
    const { format } = await img.metadata();
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp')
      return fail('Format foto harus JPG, PNG, atau WebP');
    // rotate() menerapkan arah dari EXIF; hasil WebP tidak membawa metadata (lokasi GPS ikut hilang).
    out = await img
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return fail('Berkas ini bukan foto yang valid');
  }

  const key = `listings/${l.id}/${randomUUID()}.webp`;
  try {
    await putPhoto(key, out);
  } catch {
    return fail('Foto gagal disimpan. Coba lagi.', 502);
  }
  const photos = admin ? [...l.photos, key] : l.photos;
  const pending = admin ? l.pendingPhotos : [...l.pendingPhotos, key];
  await db
    .update(listings)
    .set({ photos, pendingPhotos: pending, updatedAt: new Date() })
    .where(eq(listings.id, l.id));
  return json(view(photos, pending));
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail('Permintaan ditolak', 403);
  const body = (await req.json().catch(() => null)) as { listingId?: number; key?: string } | null;
  const ctx = await access(Number(body?.listingId));
  if (!ctx || !body?.key) return fail('Foto tidak ditemukan', 404);
  const { l } = ctx;
  if (!l.photos.includes(body.key) && !l.pendingPhotos.includes(body.key))
    return fail('Foto tidak ditemukan', 404);
  const photos = l.photos.filter((k) => k !== body.key);
  const pending = l.pendingPhotos.filter((k) => k !== body.key);
  await db.update(listings).set({ photos, pendingPhotos: pending }).where(eq(listings.id, l.id));
  await deletePhoto(body.key);
  return json(view(photos, pending));
}

/** Jadikan satu foto yang sudah disetujui sebagai sampul (urutan pertama). */
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return fail('Permintaan ditolak', 403);
  const body = (await req.json().catch(() => null)) as { listingId?: number; key?: string } | null;
  const ctx = await access(Number(body?.listingId));
  if (!ctx || !body?.key || !ctx.l.photos.includes(body.key))
    return fail('Foto tidak ditemukan', 404);
  const photos = [body.key, ...ctx.l.photos.filter((k) => k !== body.key)];
  await db.update(listings).set({ photos }).where(eq(listings.id, ctx.l.id));
  return json(view(photos, ctx.l.pendingPhotos));
}
