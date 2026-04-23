import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, postReq, mockStreamResponse, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('POST /api/fortune', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq({ method: 'bazi' }, { 'x-forwarded-for': '1.2.3.4' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq('bad'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing method', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
  });

  it('returns SSE stream on success (bazi)', async () => {
    mockSession(true);
    mockStreamResponse(mockFetch);
    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq(
      { method: 'bazi', year: 1990, month: 1, day: 1, hour: 0, gender: 'male', aspect: '事业' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('streams deterministic content without upstream calls when E2E_MOCK_STREAMS is enabled', async () => {
    process.env.E2E_MOCK_STREAMS = '1';
    mockSession(true);
    mockFetch.mockReset();

    const { POST } = await import('@/app/api/fortune/route');
    const res = await POST(postReq(
      { method: 'bazi', year: 1990, month: 1, day: 1, hour: 0, gender: 'male', aspect: '事业' },
      { 'x-forwarded-for': '1.2.3.4' },
    ));

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

    expect(text).toContain('"bazi"');
    expect(text).toContain('Mock fortune analysis');
    delete process.env.E2E_MOCK_STREAMS;
  });
});
