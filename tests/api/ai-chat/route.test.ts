import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOpenAIStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\n'));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));
}

function mockAnthropicStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, { status: 200 }));
}

function makePostReq(body: unknown) {
  return new Request('http://localhost/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai-chat', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(429);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: 'not json',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when missing provider_id', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({ messages: [{ role: 'user', content: 'hi' }] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when missing messages', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({ provider_id: 1 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when messages is empty', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({ provider_id: 1, messages: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when provider not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 999,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(404);
  });

  it('uses the env-backed Claude provider when provider_id is -1', async () => {
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    mockSession(true);
    mockAnthropicStreamResponse();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: -1,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://claude-proxy.example/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-claude-key');
    expect(JSON.parse(init.body).model).toBe('claude-opus-4-6');
  });

  it('defaults env-backed Claude requests to the right.codes messages API shape', async () => {
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.CLAUDE_MAX_TOKENS = '32000';
    delete process.env.CLAUDE_API_HOST;
    mockSession(true);
    mockAnthropicStreamResponse();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: -1,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/claude/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-claude-key');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      stream: true,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'hi',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    });
  });

  it('streams OpenAI response successfully', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
    });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    // Read the stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('"text":"hello"');
  });

  it('streams Anthropic response successfully', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 2, name: 'Claude', api_type: 'anthropic', api_url: 'https://api.anthropic.com',
        api_key: 'sk-ant-123', model: 'claude-sonnet-4-6', system_prompt: 'You are helpful',
        max_tokens: 4096,
      })),
    });
    mockAnthropicStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 2,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns 502 when upstream API fails', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
    });
    mockFetch.mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Invalid API key' } }),
      { status: 401 },
    ));
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('Invalid API key');
  });

  it('returns 502 with provider network error details', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
    });
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('connect ECONNREFUSED');
  });

  it('does not save chat history when upstream API fails before streaming', async () => {
    mockSession(true);
    const run = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
      run,
    });
    mockFetch.mockResolvedValue(new Response(
      JSON.stringify({ error: { message: 'Invalid API key' } }),
      { status: 401 },
    ));
    const { POST } = await import('@/app/api/ai-chat/route');
    await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(run).not.toHaveBeenCalled();
  });

  it('sends system prompt with OpenAI request', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: 'You are a pirate',
        max_tokens: 4096,
      })),
    });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    // Check the fetch call was made with system prompt included
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a pirate' });
  });

  it('sends only recent chat context to the upstream provider while preserving the full transcript', async () => {
    mockSession(true);
    const run = vi.fn(() => ({ lastInsertRowid: 99, changes: 1 }));
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
      run,
    });
    mockOpenAIStreamResponse();
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index}`,
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({ provider_id: 1, messages }));
    const reader = res.body!.getReader();
    while (!(await reader.read()).done) {}

    const [, init] = mockFetch.mock.calls[0];
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.messages).toHaveLength(12);
    expect(upstreamBody.messages[0].content).toBe('message-8');
    expect(upstreamBody.messages.at(-1).content).toBe('message-19');
    expect(run).toHaveBeenCalledWith(
      'message-0',
      JSON.stringify([...messages, { role: 'assistant', content: 'hello world' }]),
      99,
    );
  });

  it('stores a completed chat transcript after streaming OpenAI response', async () => {
    mockSession(true);
    const get = vi.fn(() => ({
      id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
      api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
    }));
    const run = vi.fn(() => ({ lastInsertRowid: 42, changes: 1 }));
    mockDbStmt({ get, run });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'hi there' }],
    }));

    const reader = res.body!.getReader();
    while (!(await reader.read()).done) {}

    expect(run).toHaveBeenCalledWith(
      1,
      'hi there',
      JSON.stringify([{ role: 'user', content: 'hi there' }]),
    );
    expect(run).toHaveBeenCalledWith(
      'hi there',
      JSON.stringify([
        { role: 'user', content: 'hi there' },
        { role: 'assistant', content: 'hello world' },
      ]),
      42,
    );
  });

  it('updates an existing chat transcript after streaming response', async () => {
    mockSession(true);
    const get = vi.fn()
      .mockReturnValueOnce({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })
      .mockReturnValueOnce({
        id: 9,
        provider_id: 1,
        title: 'Previous title',
        messages: '[]',
      });
    const run = vi.fn(() => ({ lastInsertRowid: 9, changes: 1 }));
    mockDbStmt({ get, run });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      chat_id: 9,
      provider_id: 1,
      messages: [{ role: 'user', content: 'continue' }],
    }));

    const reader = res.body!.getReader();
    while (!(await reader.read()).done) {}

    expect(run).toHaveBeenCalledWith(
      'Previous title',
      JSON.stringify([
        { role: 'user', content: 'continue' },
        { role: 'assistant', content: 'hello world' },
      ]),
      9,
    );
  });

  it('streams deterministic markdown without upstream calls when E2E_MOCK_STREAMS is enabled', async () => {
    process.env.E2E_MOCK_STREAMS = '1';
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Mock GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-123', model: 'gpt-4o', system_prompt: '', max_tokens: 4096,
      })),
    });

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 1,
      messages: [{ role: 'user', content: 'Render markdown' }],
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    expect(text).toContain('## Mock response');
    expect(text).toContain('- streamed item');
    delete process.env.E2E_MOCK_STREAMS;
  });
});

describe('GET /api/ai-chat', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/ai-chat/route');
    const res = await GET(new Request('http://localhost/api/ai-chat'));
    expect(res.status).toBe(401);
  });

  it('lists chat history summaries', async () => {
    mockSession(true);
    mockDbStmt({
      all: vi.fn(() => [
        { id: 2, provider_id: 1, title: 'Second', created_at: '2026-01-02', updated_at: '2026-01-02' },
        { id: 1, provider_id: 1, title: 'First', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ]),
    });
    const { GET } = await import('@/app/api/ai-chat/route');
    const res = await GET(new Request('http://localhost/api/ai-chat'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([
      { id: 2, provider_id: 1, title: 'Second', created_at: '2026-01-02', updated_at: '2026-01-02' },
      { id: 1, provider_id: 1, title: 'First', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ]);
  });
});
