export const runtime = 'nodejs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSkill, resolveSkillReference } from '@/lib/skills';
import { rateLimitByIp } from '@/lib/rateLimit';
import { isInvocableSkill } from '@/lib/skill-taxonomy';
import {
  buildClaudeHeaders,
  buildClaudeMessagesPayload,
  extractClaudeStreamText,
  getClaudeMaxTokens,
  getClaudeMessagesUrl,
  getClaudeModel,
  isClaudeStreamDone,
} from '@/lib/ai-gateway';

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

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'CLAUDE_API_KEY not configured' }), { status: 500 });

  const prompt = skill.prompt.replace('{{content}}', content);

  const payload = buildClaudeMessagesPayload({
    model: getClaudeModel(),
    maxTokens: getClaudeMaxTokens(),
    stream: true,
    messages: [{ role: 'user', content: prompt }],
    system: skill.system,
  });

  const upstream = await fetch(getClaudeMessagesUrl(), {
    method: 'POST',
    headers: buildClaudeHeaders(apiKey),
    body: JSON.stringify(payload),
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
              // Only forward text delta events
              const text = extractClaudeStreamText(parsed);
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              }
              if (isClaudeStreamDone(parsed)) {
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
