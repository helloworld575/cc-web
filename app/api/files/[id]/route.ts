export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(params.id) as { filename: string } | undefined;
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await unlink(path.join(process.cwd(), 'uploads', file.filename));
  } catch { /* file may already be gone */ }

  db.prepare('DELETE FROM files WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
