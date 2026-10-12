// Penyimpanan foto. Produksi: Cloudflare R2 (S3-compatible, lewat aws4fetch). Tanpa R2_* di
// lingkungan pengembangan, berkas disimpan di public/uploads agar bisa dicoba tanpa akun apa pun.
import { AwsClient } from 'aws4fetch';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const env = process.env;
const r2 = env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET;

const client = r2
  ? new AwsClient({
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto'
    })
  : null;
const endpoint = (key: string) =>
  `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;

const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads');

export function storageReady() {
  return !!client || env.NODE_ENV !== 'production';
}

/** Alamat publik sebuah foto. */
export function photoUrl(key: string) {
  if (client) return `${(env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')}/${key}`;
  return `/uploads/${key}`;
}

export async function putPhoto(key: string, body: Buffer) {
  if (client) {
    const res = await client.fetch(endpoint(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable'
      }
    });
    if (!res.ok) throw new Error(`R2 menolak unggahan (${res.status})`);
    return;
  }
  if (env.NODE_ENV === 'production') throw new Error('Penyimpanan foto belum diatur (R2_*)');
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

/** Hapus berkas. Kegagalan tidak boleh menggagalkan permintaan: sisa berkas hanya memakan tempat. */
export async function deletePhoto(key: string) {
  try {
    if (client) await client.fetch(endpoint(key), { method: 'DELETE' });
    else await rm(path.join(LOCAL_DIR, key), { force: true });
  } catch {
    /* abaikan */
  }
}
