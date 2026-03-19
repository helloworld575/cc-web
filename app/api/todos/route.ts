export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const todos = db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all();
  return NextResponse.json(todos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { text } = await req.json();
  const result = db.prepare('INSERT INTO todos (text) VALUES (?)').run(text);
  return NextResponse.json({ id: result.lastInsertRowid });
}
