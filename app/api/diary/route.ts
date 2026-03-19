export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const entries = db.prepare('SELECT * FROM diary ORDER BY date DESC').all();
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { date, content } = await req.json();
  if (!date || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const result = db.prepare('INSERT INTO diary (date, content) VALUES (?, ?)').run(date, content);
  return NextResponse.json({ id: result.lastInsertRowid });
}
