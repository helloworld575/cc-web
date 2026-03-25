import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const authHits = new Map<string, { count: number; reset: number }>();

export async function middleware(req: NextRequest) {
  // Rate limit auth POST
  if (req.nextUrl.pathname.startsWith('/api/auth') && req.method === 'POST') {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const key = `auth:${ip}`;
    const now = Date.now();
    const entry = authHits.get(key);
    if (!entry || now > entry.reset) {
      authHits.set(key, { count: 1, reset: now + 60_000 });
    } else {
      entry.count++;
      if (entry.count > 5) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    }
  }

  // Protect admin routes
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/auth/:path*'] };
