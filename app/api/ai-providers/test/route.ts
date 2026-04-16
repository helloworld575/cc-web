export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

/**
 * Lightweight connection test for AI providers.
 * Makes a minimal non-streaming request to verify the API key and URL work.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'ai-test', 10);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider_id } = body;
  if (!provider_id) return Response.json({ error: 'Missing provider_id' }, { status: 400 });

  const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(provider_id) as any;
  if (!provider) return Response.json({ error: 'Provider not found' }, { status: 404 });

  try {
    if (provider.api_type === 'anthropic') {
      // Anthropic: minimal non-streaming request
      const res = await fetch(`${provider.api_url}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': provider.api_key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return Response.json({
          ok: false,
          error: err.error?.message || `API returned ${res.status}`,
        });
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      return Response.json({ ok: true, text, model: data.model });

    } else {
      // OpenAI-compatible: minimal non-streaming request
      const baseUrl = provider.api_url.replace(/\/$/, '');
      const url = baseUrl.endsWith('/chat/completions')
        ? baseUrl
        : `${baseUrl}/v1/chat/completions`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 32,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return Response.json({
          ok: false,
          error: err.error?.message || `API returned ${res.status}`,
        });
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '';
      return Response.json({ ok: true, text, model: data.model });
    }
  } catch (e: any) {
    return Response.json({ ok: false, error: e.message || 'Connection failed' });
  }
}
