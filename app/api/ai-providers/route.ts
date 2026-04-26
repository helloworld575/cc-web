export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getEnvClaudeProvider, toPublicProvider, type AiProviderConfig } from '@/lib/ai-providers';

function mergeVisibleProviders(providers: AiProviderConfig[]) {
  const envProvider = getEnvClaudeProvider();
  if (!envProvider) return providers;

  return [
    envProvider,
    ...providers.map(provider => ({ ...provider, is_default: 0 })),
  ];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const providers = db.prepare('SELECT * FROM ai_providers ORDER BY is_default DESC, created_at DESC').all() as AiProviderConfig[];
  const masked = mergeVisibleProviders(providers).map(provider => toPublicProvider(provider));
  return Response.json(masked);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'ai-providers', 20);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, api_type, api_url, api_key, model, system_prompt, max_tokens, is_default } = body;
  if (!name || !api_url || !api_key || !model) {
    return Response.json({ error: 'Missing required fields: name, api_url, api_key, model' }, { status: 400 });
  }

  const type = api_type || 'openai';
  if (!['openai', 'anthropic'].includes(type)) {
    return Response.json({ error: 'api_type must be "openai" or "anthropic"' }, { status: 400 });
  }

  const envProvider = getEnvClaudeProvider();
  const savedDefault = envProvider ? 0 : is_default ? 1 : 0;

  if (savedDefault) {
    db.prepare('UPDATE ai_providers SET is_default = 0 WHERE is_default = 1').run();
  }

  const result = db.prepare(
    'INSERT INTO ai_providers (name, api_type, api_url, api_key, model, system_prompt, max_tokens, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, type, api_url.replace(/\/$/, ''), api_key, model, system_prompt || '', max_tokens || 4096, savedDefault);
  return Response.json({ id: result.lastInsertRowid }, { status: 201 });
}
