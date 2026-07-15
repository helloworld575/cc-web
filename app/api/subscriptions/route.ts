export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { validatePublicHttpUrl } from '@/.codex/skills/subscription/scripts/safe-fetch';
import {
  isSubscriptionFetchCategory,
  isSubscriptionTopic,
} from '@/lib/subscription-topics';

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

  const { name, url, category = 'other', topic = 'ai', enabled, fetch_interval } = body;
  if (typeof name !== 'string' || !name.trim() || typeof url !== 'string' || !url.trim()) {
    return Response.json({ error: 'Missing required fields: name, url' }, { status: 400 });
  }
  if (!isSubscriptionFetchCategory(category)) {
    return Response.json({ error: 'Unsupported source type' }, { status: 400 });
  }
  if (!isSubscriptionTopic(topic)) {
    return Response.json({ error: 'Unsupported subscription topic' }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = await validatePublicHttpUrl(url);
  } catch {
    return Response.json({ error: 'Invalid URL: only public HTTP(S) targets are allowed' }, { status: 400 });
  }

  const result = db.prepare(
    'INSERT INTO subscription_sources (name, url, category, topic, enabled, fetch_interval) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name.trim(), normalizedUrl, category, topic, enabled !== undefined ? (enabled ? 1 : 0) : 1, fetch_interval || 86400);

  return Response.json({ id: result.lastInsertRowid }, { status: 201 });
}
