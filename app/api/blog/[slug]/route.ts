export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getPost, savePost, deletePost } from '@/lib/markdown';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  if (!validSlug(params.slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  const post = getPost(params.slug);
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(post);
}

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validSlug(params.slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  const { title, date, content } = await req.json();
  savePost(params.slug, title, date, content);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validSlug(params.slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  deletePost(params.slug);
  return NextResponse.json({ ok: true });
}
