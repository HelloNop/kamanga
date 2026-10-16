import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

// Pengalihan cepat (optimistic): hanya mengecek ada tidaknya cookie sesi.
// BUKAN pengaman. Pemeriksaan sungguhan ada di `requireStaff()`/`requireVendor()` di layout, halaman, dan service.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Terbuka tanpa login: halaman Terima/Tolak lewat token dari pesan WA, dan berkas PWA mitra (manifest, ikon).
  if (pathname.startsWith('/mitra/pesanan/t/') || /^\/mitra\/.+\.[a-z0-9]+$/.test(pathname))
    return NextResponse.next();
  if (!getSessionCookie(request)) {
    const url = new URL('/auth/sign-in', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/mitra/:path*'] };
