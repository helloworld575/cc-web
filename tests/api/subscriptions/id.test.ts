import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { validatePublicHttpUrl } from '@/.codex/skills/subscription/scripts/safe-fetch';

vi.mock('@/.codex/skills/subscription/scripts/safe-fetch', () => ({
  validatePublicHttpUrl: vi.fn(async (value: string) => new URL(value).toString()),
}));

describe('GET /api/subscriptions/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(validatePublicHttpUrl).mockImplementation(async value => new URL(value).toString());
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/subscriptions/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { GET } = await import('@/app/api/subscriptions/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns subscription', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'My Blog', url: 'https://example.com', category: 'blog', enabled: 1,
      })),
    });
    const { GET } = await import('@/app/api/subscriptions/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('My Blog');
  });
});

describe('PUT /api/subscriptions/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(validatePublicHttpUrl).mockImplementation(async value => new URL(value).toString());
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({}),
    }), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'x', url: 'https://example.com' }),
    }), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('updates subscription successfully', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Old', url: 'https://old.com', category: 'blog', enabled: 1,
      })),
    });
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', url: 'https://new.com' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid URL', async () => {
    mockSession(true);
    vi.mocked(validatePublicHttpUrl).mockRejectedValue(new Error('Subscription URL must use http or https'));
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Old', url: 'https://old.com', category: 'blog', enabled: 1,
      })),
    });
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', url: 'not-a-url' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the updated URL resolves to a private target', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Old', url: 'https://old.com', category: 'blog', enabled: 1,
      })),
    });
    vi.mocked(validatePublicHttpUrl).mockRejectedValue(new Error('Subscription URL host is not allowed'));
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', url: 'http://127.0.0.1/private' }),
    }), { params: { id: '1' } });

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported subscription topic', async () => {
    mockSession(true);
    const statement = mockDbStmt({
      get: vi.fn(() => ({ id: 1, name: 'Old', url: 'https://old.com', category: 'rss', topic: 'ai', enabled: 1 })),
    });
    const { PUT } = await import('@/app/api/subscriptions/[id]/route');
    const response = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', url: 'https://new.com/feed.xml', category: 'rss', topic: 'finance' }),
    }), { params: { id: '1' } });

    expect(response.status).toBe(400);
    expect(statement.run).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/subscriptions/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/subscriptions/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('deletes subscription', async () => {
    mockSession(true);
    mockDbStmt();
    const { DELETE } = await import('@/app/api/subscriptions/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});
