export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const source = db.prepare('SELECT * FROM subscription_sources WHERE id = ?').get(params.id);
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(source);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'subscriptions', 20);
  if (rl) return rl;

  const existing = db.prepare('SELECT * FROM subscription_sources WHERE id = ?').get(params.id);
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, url, category, enabled, fetch_interval } = body;
  if (!name || !url) {
    return Response.json({ error: 'Missing required fields: name, url' }, { status: 400 });
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return Response.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  db.prepare(
    "UPDATE subscription_sources SET name=?, url=?, category=?, enabled=?, fetch_interval=?, updated_at=datetime('now') WHERE id=?"
  ).run(name, url, category || 'other', enabled !== undefined ? (enabled ? 1 : 0) : 1, fetch_interval || 3600, params.id);

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  db.prepare('DELETE FROM subscription_sources WHERE id = ?').run(params.id);
  return Response.json({ ok: true });
}
