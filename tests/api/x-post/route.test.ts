import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { postTweet, postThread } from '@/lib/xapi';

describe('POST /api/x-post', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(postTweet).mockResolvedValue({ id: '123', text: 'test' });
    vi.mocked(postThread).mockResolvedValue({ results: [{ id: '123', text: 'test' }], errors: [] });
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ text: 'hello' }),
    }));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ text: 'hello' }),
    }));
    expect(res.status).toBe(429);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: 'not json',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when text missing', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when text too long', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ text: 'a'.repeat(281) }),
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('281/280');
  });

  it('posts single tweet successfully', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ text: 'hello world' }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.tweet.id).toBe('123');
  });

  it('posts thread successfully', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ thread: ['1/ first', '2/ second'] }),
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('returns 502 when tweet posting fails', async () => {
    mockSession(true);
    vi.mocked(postTweet).mockResolvedValue({ error: 'Forbidden' });
    const { POST } = await import('@/app/api/x-post/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST', body: JSON.stringify({ text: 'test' }),
    }));
    expect(res.status).toBe(502);
  });
});
