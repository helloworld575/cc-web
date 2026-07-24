import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill, resolveSkillReference } from '@/lib/skills';

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
  mockFetch.mockResolvedValue(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
}

function mockResponsesStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"hello"}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":" world"}\n\n'));
      controller.enqueue(encoder.encode('data: {"type":"response.completed"}\n\n'));
      controller.close();
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
}

function mockBrokenResponsesStreamResponse() {
  const encoder = new TextEncoder();
  let reads = 0;
  const stream = new ReadableStream({
    pull(controller) {
      reads += 1;
      if (reads === 1) {
        controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"hello"}\n\n'));
        return;
      }
      throw new Error('rightcode stream aborted');
    },
  });
  mockFetch.mockResolvedValue(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
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
  mockFetch.mockResolvedValue(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
}

function makePostReq(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    body: JSON.stringify(body),
  });
}

function configureEnvOpenAiChatProvider() {
  process.env.RIGHT_CODE_GPT_API_KEY = 'test-openai-key';
  process.env.RIGHT_CODE_GPT_API_URL = 'https://api.openai.com';
  process.env.RIGHT_CODE_GPT_MODEL = 'gpt-4o';
  process.env.RIGHT_CODE_GPT_MAX_TOKENS = '4096';
  process.env.RIGHT_CODE_GPT_API_STYLE = 'chat_completions';
  return -2;
}

function configureEnvClaudeProvider() {
  process.env.CLAUDE_API_KEY = 'test-claude-key';
  process.env.CLAUDE_MODEL = 'claude-opus-4-8';
  process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
  return -1;
}

describe('POST /api/ai-chat', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (resolveSkillReference as ReturnType<typeof vi.fn>).mockReturnValue(null);
    mockFetch.mockReset();
    delete process.env.E2E_MOCK_STREAMS;
    delete process.env.RIGHT_CODE_GPT_API_STYLE;
    delete process.env.RIGHT_CODE_GPT_MAX_TOKENS;
    delete process.env.AI_CHAT_FIRST_TOKEN_TIMEOUT_MS;
    delete process.env.AI_CHAT_STREAM_IDLE_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.AI_CHAT_FIRST_TOKEN_TIMEOUT_MS;
    delete process.env.AI_CHAT_STREAM_IDLE_TIMEOUT_MS;
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

  it('rejects legacy database provider ids without reading or calling them', async () => {
    mockSession(true);
    const statement = mockDbStmt({
      get: vi.fn(() => ({
        id: 999,
        name: 'Legacy provider',
        api_type: 'openai',
        api_url: 'https://internal-ai.example',
        api_key: 'legacy-key',
        model: 'legacy-model',
        system_prompt: '',
        max_tokens: 4096,
      })),
    });
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: 999,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      code: 'provider_not_found',
      error: 'AI provider not found.',
    });
    expect(statement.get).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
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

  it('defaults env-backed Claude requests to the rightapi.ai messages API shape', async () => {
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
    expect(url).toBe('https://www.rightapi.ai/claude/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-claude-key');
    expect(init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      stream: true,
      system: expect.stringContaining('rigorous technical assistant'),
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
    const providerId = configureEnvOpenAiChatProvider();
    mockDbStmt();
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
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

  it('streams the env-backed Right Code GPT-5.5 provider through the Responses API', async () => {
    mockSession(true);
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.rightapi.ai/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    process.env.RIGHT_CODE_GPT_MAX_TOKENS = '32000';
    mockResponsesStreamResponse();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: -2,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.rightapi.ai/codex/v1/responses');
    expect(init.headers.Authorization).toBe('Bearer test-right-code-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'gpt-5.5',
      max_output_tokens: 32000,
      stream: true,
      instructions: expect.stringContaining('rigorous technical assistant'),
      input: [
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'hi' }],
        },
      ],
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain('"text":"hello"');
    expect(text).toContain('"text":" world"');
  });

  it('emits a catchable SSE error when a Right Code stream read fails', async () => {
    mockSession(true);
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.rightapi.ai/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    mockBrokenResponsesStreamResponse();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: -2,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }

    expect(text).toContain('"text":"hello"');
    expect(text).toContain('"code":"upstream_unavailable"');
    expect(text).toContain('"error":"Unable to reach AI provider."');
    expect(text).not.toContain('rightcode stream aborted');
  });

  it('injects the selected skill into AI chat requests', async () => {
    mockSession(true);
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.rightapi.ai/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'article-polish',
      name: 'Article Polish',
      description: 'Polish text',
      prompt: 'Polish this:\n\n{{content}}',
      output: 'content',
      system: 'Use a clear editorial voice.',
      invocable: true,
    });
    mockResponsesStreamResponse();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: -2,
      skill: 'article-polish',
      messages: [{ role: 'user', content: 'rough draft' }],
    }));

    expect(res.status).toBe(200);
    const [, init] = mockFetch.mock.calls[0];
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.instructions).toContain('Use a clear editorial voice.');
    expect(upstreamBody.input).toMatchObject([
      {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Polish this:\n\nrough draft',
          },
        ],
      },
    ]);
  });

  it('streams Anthropic response successfully', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    mockDbStmt();
    mockAnthropicStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('logs the Anthropic request lifecycle without recording message content', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    mockDbStmt();
    mockAnthropicStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'private prompt must stay out of logs' }],
    }, { 'x-request-id': 'req-ai-chat-log-123' }));
    await res.text();

    const entries = info.mock.calls
      .map(call => String(call[0]))
      .filter(line => line.startsWith('{'))
      .map(line => JSON.parse(line));
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        scope: 'ai-chat',
        event: 'request_started',
        request_id: 'req-ai-chat-log-123',
        model: 'claude-opus-4-8',
      }),
      expect.objectContaining({
        scope: 'ai-chat',
        event: 'request_completed',
        request_id: 'req-ai-chat-log-123',
        text_chars: 5,
      }),
    ]));
    expect(info.mock.calls.flat().join('\n')).not.toContain('private prompt must stay out of logs');
  });

  it('times out an Anthropic stream that emits metadata but no text', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.useFakeTimers();
    process.env.AI_CHAT_FIRST_TOKEN_TIMEOUT_MS = '50';
    process.env.AI_CHAT_STREAM_IDLE_TIMEOUT_MS = '20';
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 51, changes: 1 }));
    mockDbStmt({ run });
    const encoder = new TextEncoder();
    mockFetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"message_start","message":{"id":"msg_waiting"}}\n\n'));
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'wait for claude' }],
    }));
    let settled = false;
    const bodyPromise = res.text().then(text => {
      settled = true;
      return text;
    });

    await vi.advanceTimersByTimeAsync(51);

    expect(settled).toBe(true);
    const text = await bodyPromise;
    expect(text).toContain('"code":"upstream_first_token_timeout"');
    expect(text).toContain('"error":"AI provider did not return content in time."');
    expect(text).toContain('"retryable":true');
    expect(warn.mock.calls.flat().join('\n')).toContain('upstream_first_token_timeout');
    expect(run.mock.calls.flat().filter(value => typeof value === 'string' && value.startsWith('[')))
      .not.toContainEqual(expect.stringContaining('"role":"assistant"'));
  });

  it('times out an Anthropic stream that stops producing text', async () => {
    vi.useFakeTimers();
    process.env.AI_CHAT_FIRST_TOKEN_TIMEOUT_MS = '50';
    process.env.AI_CHAT_STREAM_IDLE_TIMEOUT_MS = '20';
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 52, changes: 1 }));
    mockDbStmt({ run });
    const encoder = new TextEncoder();
    mockFetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}\n\n'));
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'start then stall' }],
    }));
    let settled = false;
    const bodyPromise = res.text().then(text => {
      settled = true;
      return text;
    });

    await vi.advanceTimersByTimeAsync(21);

    expect(settled).toBe(true);
    const text = await bodyPromise;
    expect(text).toContain('"text":"partial"');
    expect(text).toContain('"code":"upstream_stream_idle_timeout"');
    expect(text).toContain('"error":"AI provider stopped returning content."');
    expect(run.mock.calls.flat().filter(value => typeof value === 'string' && value.startsWith('[')))
      .not.toContainEqual(expect.stringContaining('"role":"assistant"'));
  });

  it('preserves the latest user message when an existing Anthropic chat times out', async () => {
    vi.useFakeTimers();
    process.env.AI_CHAT_FIRST_TOKEN_TIMEOUT_MS = '50';
    process.env.AI_CHAT_STREAM_IDLE_TIMEOUT_MS = '20';
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const get = vi.fn(() => ({
      id: 9,
      provider_id: providerId,
      title: 'Existing Claude chat',
      messages: '[]',
    }));
    const run = vi.fn(() => ({ lastInsertRowid: 9, changes: 1 }));
    mockDbStmt({ get, run });
    const encoder = new TextEncoder();
    mockFetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"message_start","message":{"id":"msg_existing"}}\n\n'));
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));
    const messages = [
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'new question that times out' },
    ];

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      chat_id: 9,
      provider_id: providerId,
      messages,
    }));
    const bodyPromise = res.text();
    await vi.advanceTimersByTimeAsync(51);
    await bodyPromise;

    expect(run).toHaveBeenCalledWith(
      'Existing Claude chat',
      JSON.stringify(messages),
      9,
    );
    expect(run).not.toHaveBeenCalledWith(
      'Existing Claude chat',
      expect.stringContaining('"role":"assistant","content":""'),
      9,
    );
  });

  it('does not persist an empty assistant when Anthropic ends without text', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 53, changes: 1 }));
    mockDbStmt({ run });
    const encoder = new TextEncoder();
    mockFetch.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'empty response' }],
    }));
    const text = await res.text();

    expect(text).toContain('"code":"upstream_empty_response"');
    expect(run.mock.calls.flat().filter(value => typeof value === 'string' && value.startsWith('[')))
      .not.toContainEqual(expect.stringContaining('"role":"assistant"'));
  });

  it('returns 502 when upstream API fails', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    mockDbStmt();
    mockFetch.mockResolvedValue(new Response(
      JSON.stringify({ error: 'API Key is not allowed to access this channel' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ));
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_forbidden',
      error: 'AI provider rejected the credentials or channel access.',
      retryable: false,
    });
    expect(JSON.stringify(data)).not.toContain('API Key');
  });

  it('rejects successful HTML responses before creating chat history', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    mockDbStmt({ run });
    mockFetch.mockResolvedValue(new Response('<!doctype html><html>proxy login</html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_invalid_response',
      error: 'AI provider returned an invalid response.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toMatch(/proxy login|doctype|<html/i);
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects empty provider response bodies before creating chat history', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    mockDbStmt({ run });
    mockFetch.mockResolvedValue(new Response(null, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      code: 'upstream_empty_response',
      error: 'AI provider returned an empty response.',
      retryable: true,
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('emits a safe structured stream error for malformed SSE without exposing HTML', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 41, changes: 1 }));
    mockDbStmt({ run });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: <!doctype html><html>proxy login</html>\n\n'));
        controller.close();
      },
    });
    mockFetch.mockResolvedValue(new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('"code":"upstream_invalid_response"');
    expect(text).toContain('"error":"AI provider returned an invalid response."');
    expect(text).not.toMatch(/proxy login|doctype|<html/i);
    expect(run).not.toHaveBeenCalledWith(
      'hi',
      expect.stringContaining('"role":"assistant"'),
      expect.any(Number),
    );
  });

  it('returns 502 without provider network error details', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    mockDbStmt();
    mockFetch.mockRejectedValue(new Error('connect ECONNREFUSED internal-ai.example'));
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toEqual({
      code: 'upstream_unavailable',
      error: 'Unable to reach AI provider.',
      retryable: true,
    });
    expect(JSON.stringify(data)).not.toMatch(/ECONNREFUSED|internal-ai/i);
  });

  it('does not save chat history when upstream API fails before streaming', async () => {
    mockSession(true);
    const providerId = configureEnvClaudeProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    mockDbStmt({ run });
    mockFetch.mockResolvedValue(new Response(
      JSON.stringify({ error: 'API Key is not allowed to access this channel' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ));
    const { POST } = await import('@/app/api/ai-chat/route');
    await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    expect(run).not.toHaveBeenCalled();
  });

  it('sends the default system prompt with env OpenAI requests', async () => {
    mockSession(true);
    const providerId = configureEnvOpenAiChatProvider();
    mockDbStmt();
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi' }],
    }));

    // Check the fetch call was made with system prompt included
    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('rigorous technical assistant');
  });

  it('sends only recent chat context to the upstream provider while preserving the full transcript', async () => {
    mockSession(true);
    const providerId = configureEnvOpenAiChatProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 99, changes: 1 }));
    mockDbStmt({ run });
    mockOpenAIStreamResponse();
    const messages = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `message-${index}`,
    }));

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({ provider_id: providerId, messages }));
    const reader = res.body!.getReader();
    while (!(await reader.read()).done) {}

    const [, init] = mockFetch.mock.calls[0];
    const upstreamBody = JSON.parse(init.body);
    expect(upstreamBody.messages).toHaveLength(13);
    expect(upstreamBody.messages[0].role).toBe('system');
    expect(upstreamBody.messages[0].content).toContain('rigorous technical assistant');
    expect(upstreamBody.messages[1].content).toBe('message-8');
    expect(upstreamBody.messages.at(-1).content).toBe('message-19');
    expect(run).toHaveBeenCalledWith(
      'message-0',
      JSON.stringify([...messages, { role: 'assistant', content: 'hello world' }]),
      99,
    );
  });

  it('stores a completed chat transcript after streaming OpenAI response', async () => {
    mockSession(true);
    const providerId = configureEnvOpenAiChatProvider();
    const run = vi.fn(() => ({ lastInsertRowid: 42, changes: 1 }));
    mockDbStmt({ run });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
      messages: [{ role: 'user', content: 'hi there' }],
    }));

    const reader = res.body!.getReader();
    while (!(await reader.read()).done) {}

    expect(run).toHaveBeenCalledWith(
      providerId,
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
    const providerId = configureEnvOpenAiChatProvider();
    const get = vi.fn(() => ({
      id: 9,
      provider_id: providerId,
      title: 'Previous title',
      messages: '[]',
    }));
    const run = vi.fn(() => ({ lastInsertRowid: 9, changes: 1 }));
    mockDbStmt({ get, run });
    mockOpenAIStreamResponse();
    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      chat_id: 9,
      provider_id: providerId,
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
    const providerId = configureEnvOpenAiChatProvider();
    mockDbStmt();

    const { POST } = await import('@/app/api/ai-chat/route');
    const res = await POST(makePostReq({
      provider_id: providerId,
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
