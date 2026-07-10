export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';
import { getRuntimePaths } from '@/lib/runtime-paths';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { album_id } = await req.json();
  const { id } = await params;
  db.prepare('UPDATE files SET album_id = ? WHERE id = ?').run(album_id ?? null, Number(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as { filename: string } | undefined;
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { uploadsDir } = getRuntimePaths();
    await unlink(path.join(uploadsDir, file.filename));
  } catch { /* file may already be gone */ }

  db.prepare('DELETE FROM files WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
