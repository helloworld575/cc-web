export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const albums = db.prepare('SELECT * FROM albums ORDER BY created_at DESC').all();
  return NextResponse.json({ albums });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const result = db.prepare('INSERT INTO albums (name) VALUES (?)').run(name.trim());
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}
