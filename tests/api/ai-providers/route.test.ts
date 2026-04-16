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
    expect(data).toHaveLength(1);
    expect(data[0].api_key).toBe('••••z789'); // masked
    expect(data[0].name).toBe('GPT');
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
