import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, postReq, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill, resolveSkillReference } from '@/lib/skills';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
}

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
    process.env.CLAUDE_API_KEY = 'test-key';
    process.env.CLAUDE_MODEL = 'claude-sonnet-4-6';
    delete process.env.CLAUDE_API_HOST;
    delete process.env.RIGHT_CODE_GPT_API_KEY;
    delete process.env.RIGHT_CODE_API_KEY;
    delete process.env.RIGHT_CODE_GPT_API_URL;
    delete process.env.RIGHT_CODE_GPT_MODEL;
    delete process.env.RIGHT_CODE_GPT_API_STYLE;
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'x', content: 'c' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(429);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq('bad'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on unknown skill', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (resolveSkillReference as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq({ skill: 'nonexistent', content: 'c' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the resolved skill is not invocable', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'find-skills',
      name: 'Find Skills',
      description: 'Guide only',
      invocable: false,
    });
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq({ skill: 'find-skills', content: 'c' }));
    expect(res.status).toBe(400);
  });

  it('resolves skills by lookup reference', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (resolveSkillReference as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'article-faq',
      name: 'Article FAQ',
      prompt: '{{content}}',
      output: 'text',
      system: 'sys',
      invocable: true,
      description: 'd',
      hierarchy: { domain: 'content', category: 'article', subcategory: 'faq', path: ['content', 'article', 'faq'], order: 1 },
      lookup: { invoke: 'content/article/faq', aliases: ['faq'], keywords: ['faq'] },
    });
    mockStreamResponse();
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'content/article/faq', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(200);
  });

  it('returns SSE stream on success', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'markdown', system: 'sys', invocable: true,
    });
    mockStreamResponse();
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const streamText = await res.text();
    expect(streamText).toContain('"provider_id":-1');
    expect(streamText).toContain('"model":"claude-sonnet-4-6"');
  });

  it('sends skill prompts to Claude with the right.codes messages request shape', async () => {
    mockSession(true);
    delete process.env.CLAUDE_API_HOST;
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.CLAUDE_MAX_TOKENS = '32000';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test',
      name: 'Test',
      prompt: 'Polish: {{content}}',
      output: 'markdown',
      system: 'sys',
      invocable: true,
    });
    mockStreamResponse();

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/claude/v1/messages');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      stream: true,
      system: 'sys',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Polish: hello',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    });
  });

  it('sends skill prompts to Right Code GPT with the responses request shape', async () => {
    mockSession(true);
    delete process.env.CLAUDE_API_KEY;
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.right.codes/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    process.env.RIGHT_CODE_GPT_API_STYLE = 'responses';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test',
      name: 'Test',
      prompt: 'Polish: {{content}}',
      output: 'markdown',
      system: 'sys',
      invocable: true,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/codex/v1/responses');
    expect(init.headers.Authorization).toBe('Bearer test-right-code-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'gpt-5.5',
      stream: true,
      instructions: 'sys',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Polish: hello',
            },
          ],
        },
      ],
    });
  });

  it('uses the requested env provider for skill execution when provider_id is supplied', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.right.codes/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    process.env.RIGHT_CODE_GPT_API_STYLE = 'responses';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test',
      name: 'Test',
      prompt: 'Polish: {{content}}',
      output: 'markdown',
      system: 'sys',
      invocable: true,
    });
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"hello"}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello', provider_id: -2 },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/codex/v1/responses');
    expect(init.headers.Authorization).toBe('Bearer test-right-code-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'gpt-5.5',
      stream: true,
      instructions: 'sys',
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Polish: hello',
            },
          ],
        },
      ],
    });
  });

  it('maps provider JSON string errors to a safe bounded response', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-key';
    process.env.CLAUDE_API_HOST = 'https://internal-ai.example';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'text', system: '', invocable: true,
    });
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      error: 'API Key is not allowed to access this channel',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_forbidden',
      error: 'AI provider rejected the credentials or channel access.',
      retryable: false,
    });
    expect(JSON.stringify(data)).not.toMatch(/API Key|internal-ai/i);
  });

  it('rejects successful HTML responses instead of streaming them', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'text', system: '', invocable: true,
    });
    mockFetch.mockResolvedValue(new Response('<!doctype html><html>proxy login</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_invalid_response',
      error: 'AI provider returned an invalid response.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toMatch(/proxy login|doctype|<html/i);
  });

  it('rejects empty provider streams', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'text', system: '', invocable: true,
    });
    mockFetch.mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'upstream_empty_response',
      error: 'AI provider returned an empty response.',
      retryable: true,
    });
  });

  it('maps network failures without returning internal provider hosts', async () => {
    mockSession(true);
    process.env.CLAUDE_API_HOST = 'https://internal-ai.example';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'text', system: '', invocable: true,
    });
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED internal-ai.example'));

    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_unavailable',
      error: 'Unable to reach AI provider.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toContain('internal-ai.example');
  });
});
