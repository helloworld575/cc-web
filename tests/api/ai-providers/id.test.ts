import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

describe('GET /api/ai-providers/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 for database providers while AI config is closed', async () => {
    mockSession(true);
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(404);
  });

  it('returns an env-backed provider with a masked key', async () => {
    mockSession(true);
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-6';
    process.env.CLAUDE_API_HOST = 'https://claude-proxy.example';
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '-1' } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({
      id: -1,
      source: 'env',
      api_key: '****-key',
    }));
  });
});

describe('PUT /api/ai-providers/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({}),
    }), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 because provider configuration is env-only', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'x', api_url: 'y', model: 'z' }),
    }), { params: { id: '999' } });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({
      error: expect.stringContaining('disabled'),
    }));
  });
});

describe('DELETE /api/ai-providers/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/ai-providers/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 403 because provider configuration is env-only', async () => {
    mockSession(true);
    const { DELETE } = await import('@/app/api/ai-providers/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({
      error: expect.stringContaining('disabled'),
    }));
  });
});
