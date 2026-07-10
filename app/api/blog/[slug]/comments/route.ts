export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import db from '@/lib/db';
import { getPost } from '@/lib/markdown';
import { rateLimitByIp } from '@/lib/rateLimit';

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!getPost(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const comments = db.prepare(`
    SELECT id, author, content, created_at
    FROM blog_comments
    WHERE slug = ? AND status = 'visible'
    ORDER BY created_at ASC, id ASC
    LIMIT 100
  `).all(slug);

  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!getPost(slug)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const rl = rateLimitByIp(req, 'blog-comments', 10);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (cleanText(body.website, 120)) {
    return NextResponse.json({ ok: true });
  }

  const author = cleanText(body.author, 80);
  const content = cleanText(body.content, 2000);
  if (!author || !content) {
    return NextResponse.json({ error: 'Author and content are required' }, { status: 400 });
  }

  const result = db.prepare(`
    INSERT INTO blog_comments (slug, author, content, status)
    VALUES (?, ?, ?, 'visible')
  `).run(slug, author, content);

  const comment = db.prepare(`
    SELECT id, author, content, created_at
    FROM blog_comments
    WHERE id = ?
  `).get(result.lastInsertRowid);

  revalidatePath(`/blog/${slug}`);
  return NextResponse.json(comment);
}
