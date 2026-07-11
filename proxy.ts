import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Keep request-boundary state lightweight and isolated from SQLite/server auth config.
const authHits = new Map<string, { count: number; reset: number }>();
const MAX_AUTH_ENTRIES = 500;
const GLOBAL_AUTH_LIMIT = 50;
let globalAuthHits = { count: 0, reset: 0 };

function getClientKey(req: NextRequest) {
  if (process.env.TRUST_PROXY_HEADERS !== '1') return 'direct';
  return req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'proxy-unknown';
}

function cleanupIfNeeded() {
  if (authHits.size < MAX_AUTH_ENTRIES) return;
  const now = Date.now();
  authHits.forEach((entry, key) => {
    if (now > entry.reset) authHits.delete(key);
  });
  if (authHits.size >= MAX_AUTH_ENTRIES) {
    const firstKey = authHits.keys().next().value;
    if (firstKey !== undefined) authHits.delete(firstKey);
  }
}

export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/auth') && req.method === 'POST') {
    const now = Date.now();
    if (now > globalAuthHits.reset) {
      globalAuthHits = { count: 1, reset: now + 60_000 };
    } else {
      globalAuthHits.count += 1;
      if (globalAuthHits.count > GLOBAL_AUTH_LIMIT) {
        return NextResponse.json({ code: 'RATE_LIMITED', error: 'Too many requests' }, { status: 429 });
      }
    }

    const ip = getClientKey(req);
    const key = `auth:${ip}`;
    const entry = authHits.get(key);
    if (!entry || now > entry.reset) {
      cleanupIfNeeded();
      authHits.set(key, { count: 1, reset: now + 60_000 });
    } else {
      entry.count++;
      if (entry.count > 5) {
        return NextResponse.json({ code: 'RATE_LIMITED', error: 'Too many requests' }, { status: 429 });
      }
    }
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    // Keep this aligned with authOptions.useSecureCookies for NAS LAN HTTP access.
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: false,
    });
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/api/auth/:path*'] };
