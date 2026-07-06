export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getEnvProviderById } from '@/lib/ai-providers';
import {
  buildClaudeHeaders,
  buildClaudeMessagesPayload,
  extractClaudeResponseText,
  getClaudeMessagesUrl,
} from '@/lib/ai-gateway';
import {
  extractResponsesText,
  extractResponsesStreamText,
  getOpenAiApiStyle,
  getOpenAiEndpointUrl,
  isResponsesStreamDone,
} from '@/lib/openai-compatible';

/**
 * Lightweight connection test for AI providers.
 * Uses the cheapest request shape that can verify the API key, URL, and text extraction.
 */
async function readResponsesStreamText(upstreamBody: ReadableStream<Uint8Array>) {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const raw = trimmed.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;

      try {
        const parsed = JSON.parse(raw);
        text += extractResponsesStreamText(parsed);
        if (isResponsesStreamDone(parsed)) {
          return text;
        }
      } catch {
        // Ignore malformed SSE lines.
      }
    }
  }

  return text;
}

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

  const envProvider = getEnvProviderById(Number(provider_id));
  const provider = envProvider
    ? envProvider
    : db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(provider_id) as any;
  if (!provider) return Response.json({ error: 'Provider not found' }, { status: 404 });

  try {
    if (provider.api_type === 'anthropic') {
      // Anthropic: minimal non-streaming request
      const res = await fetch(getClaudeMessagesUrl(provider.api_url), {
        method: 'POST',
        headers: buildClaudeHeaders(provider.api_key),
        body: JSON.stringify(buildClaudeMessagesPayload({
          model: provider.model,
          maxTokens: 32,
          stream: false,
          messages: [{ role: 'user', content: 'Hi' }],
        })),
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
      const text = extractClaudeResponseText(data);
      return Response.json({ ok: true, text, model: data.model });

    } else {
      // OpenAI-compatible: minimal non-streaming request
      const apiStyle = getOpenAiApiStyle(provider);
      const isResponsesApi = apiStyle === 'responses';
      const url = getOpenAiEndpointUrl(provider);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(isResponsesApi
          ? {
              model: provider.model,
              max_output_tokens: 1024,
              stream: true,
              input: [
                {
                  type: 'message',
                  role: 'user',
                  content: [{ type: 'input_text', text: 'Hi' }],
                },
              ],
            }
          : {
              model: provider.model,
              max_tokens: 32,
              messages: [{ role: 'user', content: 'Hi' }],
            }),
        signal: AbortSignal.timeout(isResponsesApi ? 60000 : 30000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return Response.json({
          ok: false,
          error: err.error?.message || `API returned ${res.status}`,
        });
      }

      if (isResponsesApi) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream') && res.body) {
          const text = await readResponsesStreamText(res.body);
          return Response.json({ ok: true, text, model: provider.model });
        }

        const data = await res.json();
        return Response.json({
          ok: true,
          text: extractResponsesText(data),
          model: data.model || provider.model,
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
