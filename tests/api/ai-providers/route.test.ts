import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

describe('GET /api/ai-providers', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('returns providers with masked api_key', async () => {
    mockSession(true);
    const stmt = mockDbStmt({
      all: vi.fn(() => [
        { id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com', api_key: 'sk-abc123xyz789', model: 'gpt-4o', is_default: 1 },
      ]),
    });
    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const data = await res.json();
    const storedProvider = data.find((provider: { id: number }) => provider.id === 1);
    expect(storedProvider.api_key).toBe('****z789'); // masked
    expect(storedProvider.name).toBe('GPT');
  });

  it('returns an env-backed Claude provider when no providers are configured', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    mockDbStmt({ all: vi.fn(() => []) });

    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([
      expect.objectContaining({
        id: -1,
        name: 'Claude Env Default',
        api_type: 'anthropic',
        api_url: 'https://claude-proxy.example',
        api_key: '****-key',
        model: 'claude-opus-4-6',
        is_default: 1,
        source: 'env',
      }),
    ]);
  });

  it('keeps the env-backed Claude provider as default when database providers exist', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    mockDbStmt({
      all: vi.fn(() => [
        {
          id: 1,
          name: 'Stored GPT',
          api_type: 'openai',
          api_url: 'https://api.openai.com',
          api_key: 'sk-stored-key',
          model: 'gpt-4o',
          is_default: 1,
        },
      ]),
    });

    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([
      expect.objectContaining({ id: -1, source: 'env', is_default: 1 }),
      expect.objectContaining({ id: 1, name: 'Stored GPT', is_default: 0 }),
    ]);
  });

  it('returns an env-backed Right Code GPT-5.5 provider when configured', async () => {
    mockSession(true);
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.right.codes/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    process.env.RIGHT_CODE_GPT_MAX_TOKENS = '32000';
    mockDbStmt({ all: vi.fn(() => []) });

    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toContainEqual(expect.objectContaining({
      id: -2,
      name: 'Right Code GPT-5.5 Env',
      api_type: 'openai',
      api_url: 'https://www.right.codes/codex',
      api_key: '****-key',
      model: 'gpt-5.5',
      max_tokens: 32000,
      source: 'env',
    }));
  });
});

describe('POST /api/ai-providers', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required fields');
  });

  it('returns 400 on invalid api_type', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'test', api_type: 'invalid', api_url: 'https://x.com',
        api_key: 'sk-123', model: 'gpt-4',
      }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('api_type');
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({
        name: 'test', api_url: 'https://x.com',
        api_key: 'sk-123', model: 'gpt-4',
      }),
    }));
    expect(res.status).toBe(429);
  });

  it('creates provider successfully', async () => {
    mockSession(true);
    const stmt = mockDbStmt({ run: vi.fn(() => ({ lastInsertRowid: 42, changes: 1 })) });
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My GPT', api_url: 'https://api.openai.com/',
        api_key: 'sk-123', model: 'gpt-4o',
      }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(42);
  });

  it('does not let a new database provider override the env-backed default provider', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    const stmt = mockDbStmt({ run: vi.fn(() => ({ lastInsertRowid: 42, changes: 1 })) });
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        name: 'My GPT',
        api_url: 'https://api.openai.com/',
        api_key: 'sk-123',
        model: 'gpt-4o',
        is_default: 1,
      }),
    }));

    expect(res.status).toBe(201);
    expect(stmt.run).toHaveBeenCalledTimes(1);
    expect(stmt.run.mock.calls[0][7]).toBe(0);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: 'not json',
    }));
    expect(res.status).toBe(400);
  });
});
