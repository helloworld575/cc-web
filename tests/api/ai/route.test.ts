import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, postReq, mockStreamResponse, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'x', content: 'c' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(429);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq('bad'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on unknown skill', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq({ skill: 'nonexistent', content: 'c' }));
    expect(res.status).toBe(400);
  });

  it('returns SSE stream on success', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'test', name: 'Test', prompt: '{{content}}', output: 'markdown', system: 'sys',
    });
    mockStreamResponse(mockFetch);
    const { POST } = await import('@/app/api/ai/route');
    const res = await POST(postReq(
      { skill: 'test', content: 'hello' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
