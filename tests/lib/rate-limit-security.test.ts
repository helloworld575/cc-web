import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/rateLimit');

describe('rate limit client identity', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it('ignores spoofed forwarding headers unless proxy trust is enabled', async () => {
    const { getClientIp } = await import('@/lib/rateLimit');
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.50',
        'cf-connecting-ip': '203.0.113.51',
      },
    });
    expect(getClientIp(request)).toBe('direct');

    process.env.TRUST_PROXY_HEADERS = '1';
    expect(getClientIp(request)).toBe('203.0.113.51');
  });

  it('applies a global ceiling that cannot be bypassed by rotating client headers', async () => {
    process.env.TRUST_PROXY_HEADERS = '1';
    const { rateLimitByIp } = await import('@/lib/rateLimit');
    let blocked: Response | null = null;
    for (let index = 0; index < 11; index += 1) {
      blocked = rateLimitByIp(new Request('http://localhost', {
        headers: { 'x-forwarded-for': `203.0.113.${index + 1}` },
      }), 'expensive-operation', 1);
    }
    expect(blocked?.status).toBe(429);
  });
});
