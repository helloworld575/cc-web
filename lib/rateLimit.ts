const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
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
