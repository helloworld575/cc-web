const hits = new Map<string, { count: number; reset: number }>();
const MAX_ENTRIES = 1000;
const GLOBAL_LIMIT_MULTIPLIER = 10;

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  hits.forEach((entry, key) => {
    if (now > entry.reset) hits.delete(key);
  });
}, 5 * 60_000).unref();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    // Evict oldest if at capacity
    if (hits.size >= MAX_ENTRIES) {
      const firstKey = hits.keys().next().value;
      if (firstKey !== undefined) hits.delete(firstKey);
    }
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

export function getClientIp(req: Request): string {
  if (process.env.TRUST_PROXY_HEADERS !== '1') return 'direct';

  const candidate = req.headers.get('cf-connecting-ip')?.trim()
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim();

  if (!candidate || candidate.length > 64 || !/^[0-9a-f:.]+$/i.test(candidate)) {
    return 'proxy-unknown';
  }
  return candidate;
}

export function rateLimitByIp(req: Request, prefix: string, limit: number): Response | null {
  const globalLimit = Math.max(limit * GLOBAL_LIMIT_MULTIPLIER, 10);
  if (!rateLimit(`${prefix}:global`, globalLimit)) {
    return Response.json({ code: 'RATE_LIMITED', error: 'Too many requests' }, { status: 429 });
  }

  const ip = getClientIp(req);
  if (!rateLimit(`${prefix}:${ip}`, limit)) {
    return Response.json({ code: 'RATE_LIMITED', error: 'Too many requests' }, { status: 429 });
  }
  return null;
}
