export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getPost } from '@/lib/markdown';
import { getBlogViewCount, hashRequestIp, normalizeReferrer } from '@/lib/blog-analytics';
import { rateLimit } from '@/lib/rateLimit';

const VIEW_LIMIT_PER_HOUR = 60;
const VIEW_LIMIT_WINDOW_MS = 60 * 60_000;

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!getPost(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { referrer, source } = normalizeReferrer(req);
  const userAgent = (req.headers.get('user-agent') || '').trim().slice(0, 300);
  const ipHash = hashRequestIp(req);
  if (!rateLimit(`blog-view:${slug}:${ipHash}`, VIEW_LIMIT_PER_HOUR, VIEW_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  db.prepare(`
    INSERT INTO blog_view_events (slug, referrer, source, user_agent, ip_hash)
    SELECT ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1
      FROM blog_view_events
      WHERE slug = ?
        AND ip_hash = ?
        AND created_at >= datetime('now', '-5 minutes')
    )
  `).run(slug, referrer, source, userAgent, ipHash, slug, ipHash);

  return NextResponse.json({ views: getBlogViewCount(slug) });
}
