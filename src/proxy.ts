import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

// Pengalihan cepat (optimistic): hanya mengecek ada tidaknya cookie sesi.
// BUKAN pengaman. Pemeriksaan sungguhan ada di `requireSession()` pada layout dashboard.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL('/auth/sign-in', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
