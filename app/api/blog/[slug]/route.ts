export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getPost, savePost, deletePost } from '@/lib/markdown';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  const post = getPost(slug);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { title, date, content, brief } = body;
  savePost(slug, title, date, content, brief);
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!validSlug(slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  deletePost(slug);
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
  return NextResponse.json({ ok: true });
}
