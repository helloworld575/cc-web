export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const sourceId = url.searchParams.get('source_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let briefs;
  if (sourceId) {
    briefs = db.prepare(
      'SELECT b.*, s.name as source_name, s.category FROM subscription_briefs b JOIN subscription_sources s ON b.source_id = s.id WHERE b.source_id = ? ORDER BY b.fetched_at DESC LIMIT ?'
    ).all(sourceId, limit);
  } else {
    briefs = db.prepare(
      'SELECT b.*, s.name as source_name, s.category FROM subscription_briefs b JOIN subscription_sources s ON b.source_id = s.id ORDER BY b.fetched_at DESC LIMIT ?'
    ).all(limit);
  }

  return Response.json(briefs);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  db.prepare('DELETE FROM subscription_briefs WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
