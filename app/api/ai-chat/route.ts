export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function buildAnthropicRequest(provider: any, messages: ChatMessage[]) {
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  const systemPrompt = [provider.system_prompt, ...systemMessages.map(m => m.content)]
    .filter(Boolean).join('\n\n');

  const payload: Record<string, unknown> = {
    model: provider.model,
    max_tokens: provider.max_tokens || 4096,
    stream: true,
    messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
  };
  if (systemPrompt) payload.system = systemPrompt;

  return {
    url: `${provider.api_url}/v1/messages`,
    headers: {
      'x-api-key': provider.api_key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function buildOpenAIRequest(provider: any, messages: ChatMessage[]) {
  const allMessages: ChatMessage[] = [];
  if (provider.system_prompt) {
    allMessages.push({ role: 'system', content: provider.system_prompt });
  }
  allMessages.push(...messages);

  const payload = {
    model: provider.model,
    max_tokens: provider.max_tokens || 4096,
    stream: true,
    messages: allMessages.map(m => ({ role: m.role, content: m.content })),
  };

  // Determine if the URL already includes the path
  const baseUrl = provider.api_url.replace(/\/$/, '');
  const url = baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/v1/chat/completions`;

  return {
    url,
    headers: {
      'Authorization': `Bearer ${provider.api_key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function createAnthropicStream(upstreamBody: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream({
    async start(controller) {
      upstreamReader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await upstreamReader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { controller.close(); return; }
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
              }
              if (parsed.type === 'message_stop') {
                controller.close();
                return;
              }
            } catch { /* skip malformed */ }
          }
        }
      }
      controller.close();
    },
    cancel() { upstreamReader?.cancel(); },
  });
}

function createOpenAIStream(upstreamBody: ReadableStream<Uint8Array>) {
  const encoder = new TextEncoder();
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream({
    async start(controller) {
      upstreamReader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await upstreamReader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { controller.close(); return; }
            try {
              const parsed = JSON.parse(raw);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`));
              }
              if (parsed.choices?.[0]?.finish_reason) {
                controller.close();
                return;
              }
            } catch { /* skip malformed */ }
          }
        }
      }
      controller.close();
    },
    cancel() { upstreamReader?.cancel(); },
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'ai-chat', 30);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { provider_id, messages } = body;
  if (!provider_id || !messages || !Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Missing provider_id or messages' }, { status: 400 });
  }

  const provider = db.prepare('SELECT * FROM ai_providers WHERE id = ?').get(provider_id) as any;
  if (!provider) {
    return Response.json({ error: 'Provider not found' }, { status: 404 });
  }

  // Build request based on provider type
  const reqConfig = provider.api_type === 'anthropic'
    ? buildAnthropicRequest(provider, messages)
    : buildOpenAIRequest(provider, messages);

  const upstream = await fetch(reqConfig.url, {
    method: 'POST',
    headers: reqConfig.headers,
    body: reqConfig.body,
  });

  if (!upstream.ok) {
    let msg = 'AI API error';
    try { const err = await upstream.json(); msg = err.error?.message ?? JSON.stringify(err.error) ?? msg; } catch {}
    return Response.json({ error: msg }, { status: 502 });
  }

  const stream = provider.api_type === 'anthropic'
    ? createAnthropicStream(upstream.body!)
    : createOpenAIStream(upstream.body!);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
