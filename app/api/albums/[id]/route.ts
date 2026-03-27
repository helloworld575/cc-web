export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, cover_file_id } = await req.json();
  const sets: string[] = [];
  const vals: (string | number)[] = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (cover_file_id !== undefined) { sets.push('cover_file_id = ?'); vals.push(cover_file_id); }
  if (!sets.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  vals.push(Number(params.id));
  db.prepare(`UPDATE albums SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = Number(params.id);
  db.prepare('UPDATE files SET album_id = NULL WHERE album_id = ?').run(id);
  db.prepare('DELETE FROM albums WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
