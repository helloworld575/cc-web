export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSkill, resolveSkillReference } from '@/lib/skills';
import { rateLimitByIp } from '@/lib/rateLimit';
import { isInvocableSkill } from '@/lib/skill-taxonomy';
import { getEnvProviders, type AiProviderConfig } from '@/lib/ai-providers';
import {
  buildClaudeHeaders,
  buildClaudeMessagesPayload,
  extractClaudeStreamText,
  getClaudeMessagesUrl,
  isClaudeStreamDone,
} from '@/lib/ai-gateway';
import {
  extractResponsesStreamText,
  getOpenAiApiStyle,
  getOpenAiEndpointUrl,
  isResponsesStreamDone,
} from '@/lib/openai-compatible';

function getDefaultProvider() {
  return getEnvProviders().find(provider => provider.is_default);
}

function buildAnthropicRequest(provider: AiProviderConfig, prompt: string, system?: string) {
  const payload = buildClaudeMessagesPayload({
    model: provider.model,
    maxTokens: provider.max_tokens || undefined,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
    system,
  });

  return {
    url: getClaudeMessagesUrl(provider.api_url),
    headers: buildClaudeHeaders(provider.api_key),
    body: JSON.stringify(payload),
  };
}

function buildResponsesRequest(provider: AiProviderConfig, prompt: string, system?: string) {
  const payload: Record<string, unknown> = {
    model: provider.model,
    max_output_tokens: provider.max_tokens || 4096,
    stream: true,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
  };
  if (system) payload.instructions = system;

  return {
    url: getOpenAiEndpointUrl(provider),
    headers: {
      Authorization: `Bearer ${provider.api_key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function buildOpenAIRequest(provider: AiProviderConfig, prompt: string, system?: string) {
  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ];
  const payload = {
    model: provider.model,
    max_tokens: provider.max_tokens || 4096,
    stream: true,
    messages,
  };

  return {
    url: getOpenAiEndpointUrl(provider),
    headers: {
      Authorization: `Bearer ${provider.api_key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function extractOpenAIChatStreamText(event: any) {
  return event?.choices?.[0]?.delta?.content || '';
}

function isOpenAIChatStreamDone(event: any) {
  return Boolean(event?.choices?.[0]?.finish_reason);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const rl = rateLimitByIp(req, 'ai', 10);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 }); }
  const { skill: skillId, content } = body;
  if (!skillId || !content) return new Response(JSON.stringify({ error: 'Missing skill or content' }), { status: 400 });

  const skill = getSkill(skillId) ?? resolveSkillReference(skillId);
  if (!skill) return new Response(JSON.stringify({ error: `Unknown skill: ${skillId}` }), { status: 400 });
  if (!isInvocableSkill(skill)) {
    return new Response(JSON.stringify({ error: `Skill is not invocable: ${skillId}` }), { status: 400 });
  }

  const provider = getDefaultProvider();
  if (!provider) {
    return new Response(JSON.stringify({ error: 'No env AI provider configured' }), { status: 500 });
  }

  const prompt = skill.prompt.replace('{{content}}', content);

  const openAiApiStyle = provider.api_type === 'openai'
    ? getOpenAiApiStyle(provider)
    : null;
  const requestConfig = provider.api_type === 'anthropic'
    ? buildAnthropicRequest(provider, prompt, skill.system)
    : openAiApiStyle === 'responses'
      ? buildResponsesRequest(provider, prompt, skill.system)
      : buildOpenAIRequest(provider, prompt, skill.system);

  const upstream = await fetch(requestConfig.url, {
    method: 'POST',
    headers: requestConfig.headers,
    body: requestConfig.body,
  });

  if (!upstream.ok) {
    let msg = 'Claude API error';
    try { const err = await upstream.json(); msg = err.error?.message ?? msg; } catch {}
    return new Response(JSON.stringify({ error: msg }), { status: 502 });
  }

  const outputType = skill.output;
  const encoder = new TextEncoder();
  const upstreamBody = upstream.body!;
  let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      // First, send output type so client knows how to handle result
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: outputType })}\n\n`));

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
              const text = provider.api_type === 'anthropic'
                ? extractClaudeStreamText(parsed)
                : openAiApiStyle === 'responses'
                  ? extractResponsesStreamText(parsed)
                  : extractOpenAIChatStreamText(parsed);
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
              const doneEvent = provider.api_type === 'anthropic'
                ? isClaudeStreamDone(parsed)
                : openAiApiStyle === 'responses'
                  ? isResponsesStreamDone(parsed)
                  : isOpenAIChatStreamDone(parsed);
              if (doneEvent) {
                controller.close();
                return;
              }
            } catch { /* skip malformed lines */ }
          }
        }
      }
      controller.close();
    },
    cancel() { upstreamReader?.cancel(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
