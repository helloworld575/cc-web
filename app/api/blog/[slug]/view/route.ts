export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getPost } from '@/lib/markdown';
import { getBlogViewCount, hashRequestIp, normalizeReferrer } from '@/lib/blog-analytics';

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (!validSlug(params.slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!getPost(params.slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { referrer, source } = normalizeReferrer(req);
  const userAgent = (req.headers.get('user-agent') || '').trim().slice(0, 300);
  const ipHash = hashRequestIp(req);

  db.prepare(`
    INSERT INTO blog_view_events (slug, referrer, source, user_agent, ip_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(params.slug, referrer, source, userAgent, ipHash);

  return NextResponse.json({ views: getBlogViewCount(params.slug) });
}
