import { createHash } from 'node:crypto';

export const SESSION_COOKIE = 'kamanga_sid';

/** IP dipakai hanya untuk membatasi pemakaian; yang disimpan hanya hash-nya (UU PDP).
 *  Mengandalkan reverse proxy (Caddy) yang menimpa X-Forwarded-For; tanpa proxy, header ini bisa dipalsukan. */
export function ipHashOf(headers: Headers): string {
  const ip = (
    headers.get('x-forwarded-for')?.split(',')[0] ??
    headers.get('x-real-ip') ??
    'unknown'
  ).trim();
  return createHash('sha256')
    .update(`${ip}|${process.env.BETTER_AUTH_SECRET ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

/** Tolak permintaan lintas situs: Origin, bila ada, harus sama dengan Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 30
});
