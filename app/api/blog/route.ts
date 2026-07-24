export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getPosts, savePost } from '@/lib/markdown';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isCanonicalBlogDate } from '@/lib/blog-list';

export async function GET() {
  return NextResponse.json(getPosts());
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { slug, title, date, content } = body;
  if (!slug || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  if (!isCanonicalBlogDate(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  savePost(slug, title, date, content);
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  return NextResponse.json({ ok: true });
}
