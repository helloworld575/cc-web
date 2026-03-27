const hits = new Map<string, { count: number; reset: number }>();
const MAX_ENTRIES = 1000;

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.reset) hits.delete(key);
  }
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

export function rateLimitByIp(req: Request, prefix: string, limit: number): Response | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`${prefix}:${ip}`, limit)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 });
  }
  return null;
}
