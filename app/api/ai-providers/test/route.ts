export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getEnvProviderById } from '@/lib/ai-providers';
import {
  readUpstreamFailure,
  readUpstreamJson,
  safeFetchError,
  timeoutSignal,
  upstreamEmptyResponseError,
  upstreamInvalidResponseError,
  validateUpstreamSse,
} from '@/lib/ai-upstream';
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
  let bytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 2 * 1024 * 1024) {
      await reader.cancel().catch(() => undefined);
      return { ok: false as const, error: upstreamInvalidResponseError('AI provider') };
    }
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
          return text
            ? { ok: true as const, text }
            : { ok: false as const, error: upstreamEmptyResponseError('AI provider') };
        }
      } catch {
        return { ok: false as const, error: upstreamInvalidResponseError('AI provider') };
      }
    }
  }

  return { ok: false as const, error: upstreamInvalidResponseError('AI provider') };
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

  const provider = getEnvProviderById(Number(provider_id));
  if (!provider) {
    return Response.json({ code: 'provider_not_found', error: 'AI provider not found.' }, { status: 404 });
  }

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
        signal: timeoutSignal(30000),
      });

      if (!res.ok) {
        const failure = await readUpstreamFailure(res);
        console.warn('[ai-provider-test]', failure.logDetail);
        return Response.json({ ok: false, ...failure.payload });
      }

      const parsed = await readUpstreamJson(res);
      if (!parsed.ok) return Response.json({ ok: false, ...parsed.failure.payload });
      const text = extractClaudeResponseText(parsed.data);
      if (!text) return Response.json({ ok: false, ...upstreamEmptyResponseError() });
      return Response.json({ ok: true, text, model: parsed.data.model });

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
        signal: timeoutSignal(isResponsesApi ? 60000 : 30000),
      });

      if (!res.ok) {
        const failure = await readUpstreamFailure(res);
        console.warn('[ai-provider-test]', failure.logDetail);
        return Response.json({ ok: false, ...failure.payload });
      }

      if (isResponsesApi) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream')) {
          const validated = await validateUpstreamSse(res);
          if (!validated.ok) return Response.json({ ok: false, ...validated.payload });
          const streamed = await readResponsesStreamText(validated.body);
          if (!streamed.ok) return Response.json({ ok: false, ...streamed.error });
          return Response.json({ ok: true, text: streamed.text, model: provider.model });
        }

        const parsed = await readUpstreamJson(res);
        if (!parsed.ok) return Response.json({ ok: false, ...parsed.failure.payload });
        const text = extractResponsesText(parsed.data);
        if (!text) return Response.json({ ok: false, ...upstreamEmptyResponseError() });
        return Response.json({
          ok: true,
          text,
          model: parsed.data.model || provider.model,
        });
      }

      const parsed = await readUpstreamJson(res);
      if (!parsed.ok) return Response.json({ ok: false, ...parsed.failure.payload });
      const text = parsed.data.choices?.[0]?.message?.content || '';
      if (!text) return Response.json({ ok: false, ...upstreamEmptyResponseError() });
      return Response.json({ ok: true, text, model: parsed.data.model });
    }
  } catch (caught: unknown) {
    return Response.json({ ok: false, ...safeFetchError(caught) });
  }
}
