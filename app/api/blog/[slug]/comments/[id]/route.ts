export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

function validSlug(slug: string) {
  return /^[a-z0-9-]+$/.test(slug);
}

export async function DELETE(_: Request, { params }: { params: { slug: string; id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!validSlug(params.slug)) return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid comment id' }, { status: 400 });
  }

  db.prepare('DELETE FROM blog_comments WHERE id = ? AND slug = ?').run(id, params.slug);
  revalidatePath(`/blog/${params.slug}`);
  return NextResponse.json({ ok: true });
}
