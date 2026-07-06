import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makePostReq(body: unknown) {
  return new Request('http://localhost/api/ai-providers/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/ai-providers/test', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: 1 }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: 1 }));
    expect(res.status).toBe(429);
  });

  it('tests the env-backed Claude provider with provider_id -1', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      content: [{ text: 'ok' }],
      model: 'claude-opus-4-6',
    }), { status: 200 }));

    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: -1 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, text: 'ok', model: 'claude-opus-4-6' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://claude-proxy.example/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-claude-key');
  });

  it('tests env-backed Claude through the default right.codes messages request shape', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    delete process.env.CLAUDE_API_HOST;
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      content: [{ text: 'ok' }],
      model: 'claude-opus-4-8',
    }), { status: 200 }));

    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: -1 }));

    expect(res.status).toBe(200);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/claude/v1/messages');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-opus-4-8',
      max_tokens: 32,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Hi',
              cache_control: { type: 'ephemeral' },
            },
          ],
        },
      ],
    });
  });

  it('tests the env-backed Right Code GPT-5.5 provider with OpenAI-compatible requests', async () => {
    mockSession(true);
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.right.codes/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
      model: 'gpt-5.5',
    }), { status: 200 }));

    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: -2 }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, text: 'ok', model: 'gpt-5.5' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/codex/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-right-code-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'gpt-5.5',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Hi' }],
    });
  });

  it('returns 404 when a stored provider is missing', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { POST } = await import('@/app/api/ai-providers/test/route');
    const res = await POST(makePostReq({ provider_id: 999 }));
    expect(res.status).toBe(404);
  });
});
