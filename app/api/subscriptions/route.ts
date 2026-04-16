export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sources = db.prepare('SELECT * FROM subscription_sources ORDER BY created_at DESC').all();
  return Response.json(sources);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'subscriptions', 20);
  if (rl) return rl;

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

  const result = db.prepare(
    'INSERT INTO subscription_sources (name, url, category, enabled, fetch_interval) VALUES (?, ?, ?, ?, ?)'
  ).run(name, url, category || 'other', enabled !== undefined ? (enabled ? 1 : 0) : 1, fetch_interval || 3600);

  return Response.json({ id: result.lastInsertRowid }, { status: 201 });
}
