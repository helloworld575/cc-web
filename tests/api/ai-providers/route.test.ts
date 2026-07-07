import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';
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

  it('returns only env-backed providers with masked api keys', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    process.env.RIGHT_CODE_GPT_API_KEY = 'test-right-code-key';
    process.env.RIGHT_CODE_GPT_API_URL = 'https://www.right.codes/codex';
    process.env.RIGHT_CODE_GPT_MODEL = 'gpt-5.5';
    mockDbStmt({
      all: vi.fn(() => [
        { id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com', api_key: 'sk-abc123xyz789', model: 'gpt-4o', is_default: 1 },
      ]),
    });
    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([
      expect.objectContaining({
        id: -1,
        name: 'Claude Env Default',
        api_key: '****-key',
        source: 'env',
        is_default: 1,
      }),
      expect.objectContaining({
        id: -2,
        name: 'Right Code GPT-5.5 Env',
        api_key: '****-key',
        source: 'env',
        is_default: 0,
      }),
    ]);
    expect(data).not.toContainEqual(expect.objectContaining({ id: 1 }));
  });

  it('returns an empty list when no env providers are configured', async () => {
    mockSession(true);
    delete process.env.CLAUDE_API_KEY;
    delete process.env.RIGHT_CODE_GPT_API_KEY;
    delete process.env.RIGHT_CODE_API_KEY;
    mockDbStmt({ all: vi.fn(() => []) });

    const { GET } = await import('@/app/api/ai-providers/route');
    const res = await GET(new Request('http://localhost'));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
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

  it('returns 403 because provider configuration is env-only', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai-providers/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('disabled');
  });
});
