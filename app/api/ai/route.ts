export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSkill } from '@/lib/skills';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { skill: skillId, content } = await req.json();
  if (!skillId || !content) return new Response(JSON.stringify({ error: 'Missing skill or content' }), { status: 400 });

  const skill = getSkill(skillId);
  if (!skill) return new Response(JSON.stringify({ error: `Unknown skill: ${skillId}` }), { status: 400 });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'CLAUDE_API_KEY not configured' }), { status: 500 });

  const host = (process.env.CLAUDE_API_HOST ?? 'https://api.anthropic.com').replace(/\/$/, '');
  const prompt = skill.prompt.replace('{{content}}', content);

  const body: Record<string, unknown> = {
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    max_tokens: 4096,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  };
  if (skill.system) body.system = skill.system;

  const upstream = await fetch(`${host}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.json();
    return new Response(JSON.stringify({ error: err.error?.message ?? 'Claude API error' }), { status: 502 });
  }

  // Stream SSE from Claude to the client, injecting the output type in the first chunk
  const outputType = skill.output;
  const encoder = new TextEncoder();
  const upstreamBody = upstream.body!;

  const stream = new ReadableStream({
    async start(controller) {
      // First, send output type so client knows how to handle result
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: outputType })}\n\n`));

      const reader = upstreamBody.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
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
              // Only forward text delta events
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
              }
              if (parsed.type === 'message_stop') {
                controller.close();
                return;
              }
            } catch { /* skip malformed lines */ }
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
