import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { runDailySubscriptionPublishing } from '@/lib/subscription-daily';

vi.mock('@/lib/subscription-daily', () => ({
  runDailySubscriptionPublishing: vi.fn(),
}));

describe('POST /api/subscriptions/daily', () => {
  beforeEach(() => {
    vi.mocked(runDailySubscriptionPublishing).mockReset();
    vi.mocked(runDailySubscriptionPublishing).mockResolvedValue({
      run_date: '2026-07-16',
      status: 'published',
      crawl: { total: 2, success: 2, failed: 0 },
      publications: [
        { topic: 'ai', slug: '20260716-ai-daily', status: 'published' },
        { topic: 'security', slug: '20260716-security-daily', status: 'published' },
      ],
    });
  });

  it('rejects requests without an admin session or cron token', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/daily/route');
    const response = await POST(new Request('http://localhost/api/subscriptions/daily', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('runs one idempotent daily publishing job with the cron token', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/daily/route');
    const response = await POST(new Request('http://localhost/api/subscriptions/daily', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_PASSWORD}`,
        'X-Request-ID': 'daily-job-test',
      },
    }));

    expect(response.status).toBe(200);
    expect(runDailySubscriptionPublishing).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'daily-job-test',
    }));
    await expect(response.json()).resolves.toMatchObject({
      status: 'published',
      publications: [{ topic: 'ai' }, { topic: 'security' }],
    });
  });
});
