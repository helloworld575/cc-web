import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

describe('GET /api/subscriptions', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(401);
  });

  it('returns subscriptions list', async () => {
    mockSession(true);
    mockDbStmt({
      all: vi.fn(() => [
        { id: 1, name: 'My Blog', url: 'https://example.com', category: 'blog', enabled: 1 },
      ]),
    });
    const { GET } = await import('@/app/api/subscriptions/route');
    const res = await GET(new Request('http://localhost'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('My Blog');
  });
});

describe('POST /api/subscriptions', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required fields');
  });

  it('returns 400 on invalid URL', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'test', url: 'not-a-url' }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid URL');
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ name: 'test', url: 'https://example.com' }),
    }));
    expect(res.status).toBe(429);
  });

  it('creates subscription successfully', async () => {
    mockSession(true);
    mockDbStmt({ run: vi.fn(() => ({ lastInsertRowid: 42, changes: 1 })) });
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Blog', url: 'https://example.com' }),
    }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(42);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/subscriptions/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: 'not json',
    }));
    expect(res.status).toBe(400);
  });
});
