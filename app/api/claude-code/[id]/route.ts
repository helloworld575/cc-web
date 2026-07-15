export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { logServerEvent } from '@/lib/server-log';

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseMessages(raw: string) {
  try {
    const messages = JSON.parse(raw);
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return Response.json({ code: 'CLAUDE_CHAT_INVALID', error: 'Invalid conversation id.' }, { status: 400 });

  const chat = db.prepare('SELECT * FROM claude_assistant_sessions WHERE id = ?').get(id) as {
    session_uuid?: string;
    messages: string;
    [key: string]: unknown;
  } | undefined;
  if (!chat) return Response.json({ code: 'CLAUDE_CHAT_NOT_FOUND', error: 'Conversation not found.' }, { status: 404 });

  const { session_uuid: _sessionUuid, ...safeChat } = chat;
  return Response.json({ ...safeChat, messages: parseMessages(chat.messages) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (!id) return Response.json({ code: 'CLAUDE_CHAT_INVALID', error: 'Invalid conversation id.' }, { status: 400 });

  const chat = db.prepare('SELECT id, status FROM claude_assistant_sessions WHERE id = ?')
    .get(id) as { id: number; status: string } | undefined;
  if (!chat) return Response.json({ code: 'CLAUDE_CHAT_NOT_FOUND', error: 'Conversation not found.' }, { status: 404 });
  if (chat.status === 'running') {
    return Response.json({ code: 'CLAUDE_CHAT_BUSY', error: 'Conversation is currently running.' }, { status: 409 });
  }

  db.prepare('DELETE FROM claude_assistant_sessions WHERE id = ?').run(rawId);
  logServerEvent('info', 'claude-code', 'conversation_deleted', { chat_id: id });
  return Response.json({ ok: true });
}
