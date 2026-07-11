export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

function readStrictInteger(value: string | null) {
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawSourceId = url.searchParams.get('source_id');
  const sourceId = rawSourceId === null ? null : readStrictInteger(rawSourceId);
  if (rawSourceId !== null && (sourceId === null || sourceId <= 0)) {
    return Response.json({ error: 'Invalid source_id' }, { status: 400 });
  }

  const rawLimit = url.searchParams.get('limit');
  const parsedLimit = rawLimit === null ? 50 : readStrictInteger(rawLimit);
  if (parsedLimit === null) {
    return Response.json({ error: 'Invalid limit' }, { status: 400 });
  }
  const limit = Math.min(100, Math.max(1, parsedLimit));

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
