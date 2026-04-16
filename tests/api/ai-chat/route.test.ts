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
});
