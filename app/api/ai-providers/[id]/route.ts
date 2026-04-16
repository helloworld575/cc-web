export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(params.id) as any;
  if (!provider) return Response.json({ error: 'Not found' }, { status: 404 });

  // Mask API key
  return Response.json({
    ...provider,
    api_key: provider.api_key ? '••••' + provider.api_key.slice(-4) : '',
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'ai-providers', 20);
  if (rl) return rl;

  const existing = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(params.id) as any;
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, api_type, api_url, api_key, model, system_prompt, max_tokens, is_default } = body;
  if (!name || !api_url || !model) {
    return Response.json({ error: 'Missing required fields: name, api_url, model' }, { status: 400 });
  }

  const type = api_type || existing.api_type;
  if (!['openai', 'anthropic'].includes(type)) {
    return Response.json({ error: 'api_type must be "openai" or "anthropic"' }, { status: 400 });
  }

  // If api_key looks masked, keep the existing one
  const resolvedKey = (!api_key || api_key.startsWith('••••')) ? existing.api_key : api_key;

  // If setting as default, clear existing default
  if (is_default) {
    db.prepare('UPDATE ai_providers SET is_default = 0 WHERE is_default = 1').run();
  }

  db.prepare(
    "UPDATE ai_providers SET name=?, api_type=?, api_url=?, api_key=?, model=?, system_prompt=?, max_tokens=?, is_default=?, updated_at=datetime('now') WHERE id=?"
  ).run(name, type, api_url.replace(/\/$/, ''), resolvedKey, model,
    system_prompt ?? existing.system_prompt, max_tokens ?? existing.max_tokens,
    is_default ? 1 : 0, params.id);
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  db.prepare('DELETE FROM ai_providers WHERE id = ?').run(params.id);
  return Response.json({ ok: true });
}
