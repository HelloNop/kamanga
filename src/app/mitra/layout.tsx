import type { Metadata, Viewport } from 'next';

// Seluruh /mitra (panel dan halaman token): aplikasi yang bisa dipasang ke layar utama (PWA).
export const metadata: Metadata = {
  title: { default: 'Kamanga Mitra', template: '%s | Kamanga Mitra' },
  manifest: '/mitra/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Kamanga Mitra', statusBarStyle: 'default' },
  icons: { apple: '/mitra/ikon/180.png' },
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: '#2d5a73' };

export default function MitraRoot({ children }: { children: React.ReactNode }) {
  return children;
}
