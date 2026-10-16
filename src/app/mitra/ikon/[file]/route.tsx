import { ImageResponse } from 'next/og';

// Ikon PWA dibuat dari kode (belum ada berkas ikon PNG di public/): huruf K di atas warna utama Kamanga.
// Alamat: /mitra/ikon/180.png, /mitra/ikon/192.png, /mitra/ikon/512.png.
const SIZES = [180, 192, 512];

export function generateStaticParams() {
  return SIZES.map((s) => ({ file: `${s}.png` }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const size = Number((await ctx.params).file.replace(/\.png$/, ''));
  if (!SIZES.includes(size)) return new Response('Tidak ditemukan', { status: 404 });
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #4f90a8, #2d5a73)',
        color: '#ffffff',
        fontSize: size * 0.6,
        fontWeight: 700
      }}
    >
      K
    </div>,
    { width: size, height: size }
  );
}
