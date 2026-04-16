export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const chat = db.prepare('SELECT * FROM ai_chat_history WHERE id = ?').get(params.id) as any;
  if (!chat) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ ...chat, messages: JSON.parse(chat.messages) });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = db.prepare('SELECT * FROM ai_chat_history WHERE id = ?').get(params.id) as any;
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  db.prepare("UPDATE ai_chat_history SET title=?, messages=?, updated_at=datetime('now') WHERE id=?").run(
    body.title ?? existing.title,
    body.messages ? JSON.stringify(body.messages) : existing.messages,
    params.id
  );
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  db.prepare('DELETE FROM ai_chat_history WHERE id = ?').run(params.id);
  return Response.json({ ok: true });
}
