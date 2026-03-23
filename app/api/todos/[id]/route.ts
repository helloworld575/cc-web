export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(params.id);
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(todo);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(params.id) as any;
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const text = body.text ?? existing.text;
  const done = body.done !== undefined ? (body.done ? 1 : 0) : existing.done;
  const deadline = body.deadline !== undefined ? (body.deadline || null) : existing.deadline;
  db.prepare('UPDATE todos SET text = ?, done = ?, deadline = ? WHERE id = ?').run(text, done, deadline, params.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  db.prepare('DELETE FROM todos WHERE id = ?').run(params.id);
  return NextResponse.json({ ok: true });
}
