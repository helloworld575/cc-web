import crypto from 'crypto';
import db from '@/lib/db';

export interface BlogViewCount {
  slug: string;
  views: number;
}

export function normalizeReferrer(req: Request) {
  const raw = (req.headers.get('referer') || '').trim().slice(0, 500);
  if (!raw) return { referrer: '', source: 'direct' };

  try {
    const referrerUrl = new URL(raw);
    const requestUrl = new URL(req.url);
    const source = referrerUrl.host === requestUrl.host ? 'internal' : referrerUrl.hostname;
    return { referrer: raw, source };
  } catch {
    return { referrer: raw, source: 'unknown' };
  }
}

export function hashRequestIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || req.headers.get('x-real-ip') || 'unknown';
  const salt = process.env.NEXTAUTH_SECRET || process.env.ADMIN_PASSWORD || 'local-dev';
  return crypto.createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export function getBlogViewCount(slug: string) {
  const row = db.prepare('SELECT COUNT(*) as views FROM blog_view_events WHERE slug = ?').get(slug) as { views?: number } | undefined;
  return Number(row?.views || 0);
}

export function getBlogViewCounts(slugs: string[]) {
  if (slugs.length === 0) return new Map<string, number>();

  const placeholders = slugs.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT slug, COUNT(*) as views FROM blog_view_events WHERE slug IN (${placeholders}) GROUP BY slug`
  ).all(...slugs) as BlogViewCount[];

  return new Map(rows.map(row => [row.slug, Number(row.views || 0)]));
}
