import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';

describe('POST /api/subscriptions/fetch', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 when the subscription skill is not invocable', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'subscription',
      name: 'Subscription',
      description: 'Guide only',
      invocable: false,
    });
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Subscription skill is not invocable' });
  });
});
