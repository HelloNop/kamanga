// Manifest PWA dashboard mitra. Terbuka tanpa login (proxy.ts membiarkan berkas ber-ekstensi di /mitra/).
export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    {
      name: 'Kamanga Mitra',
      short_name: 'Kamanga Mitra',
      description: 'Kelola pesanan, jadwal, dan usaha Anda di Kamanga.',
      lang: 'id',
      start_url: '/mitra',
      scope: '/mitra',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#2d5a73',
      icons: [192, 512].map((s) => ({
        src: `/mitra/ikon/${s}.png`,
        sizes: `${s}x${s}`,
        type: 'image/png',
        purpose: 'any'
      }))
    },
    { headers: { 'content-type': 'application/manifest+json' } }
  );
}
