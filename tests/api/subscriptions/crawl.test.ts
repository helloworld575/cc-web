import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { fetchByCategory } from '@/lib/fetchers';
import db from '@/lib/db';

describe('POST /api/subscriptions/crawl', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(fetchByCategory).mockResolvedValue({
      title: 'Fetched AI Source',
      content: 'Latest AI content from the web',
    });
  });

  it('returns 401 without session or cron token', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/crawl/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/crawl', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('allows a local cron bearer token to crawl subscriptions without a session', async () => {
    mockSession(false);
    const insertRun = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    const updateRun = vi.fn(() => ({ changes: 1 }));
    const allSources = vi.fn(() => [
      { id: 1, name: 'AI Source', url: 'https://example.com/ai', category: 'rss', enabled: 1 },
    ]);
    const existingItem = vi.fn(() => undefined);
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE enabled = 1')) {
        return { all: allSources };
      }
      if (sql.includes('SELECT id FROM subscription_items')) {
        return { get: existingItem };
      }
      if (sql.includes('INSERT INTO subscription_items')) {
        return { run: insertRun };
      }
      if (sql.includes('UPDATE subscription_sources')) {
        return { run: updateRun };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/crawl/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/crawl', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.ADMIN_PASSWORD}` },
      body: JSON.stringify({}),
    }));

    expect(res.status).toBe(200);
    expect(fetchByCategory).toHaveBeenCalledWith('https://example.com/ai', 'rss');
    expect(insertRun).toHaveBeenCalledWith(
      1,
      'Fetched AI Source',
      'https://example.com/ai',
      'Latest AI content from the web',
      expect.any(String),
    );
    expect(updateRun).toHaveBeenCalledWith(1);
  });

  it('stores fetched content as a raw subscription item without calling AI', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mockSession(true);
    const insertRun = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    const updateRun = vi.fn(() => ({ changes: 1 }));
    const getSource = vi.fn(() => (
      { id: 1, name: 'AI Source', url: 'https://example.com/ai', category: 'rss', enabled: 1 }
    ));
    const existingItem = vi.fn(() => undefined);
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ? AND enabled = 1')) {
        return { get: getSource };
      }
      if (sql.includes('SELECT id FROM subscription_items')) {
        return { get: existingItem };
      }
      if (sql.includes('INSERT INTO subscription_items')) {
        return { run: insertRun };
      }
      if (sql.includes('UPDATE subscription_sources')) {
        return { run: updateRun };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/crawl/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/crawl', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      total: 1,
      results: [
        expect.objectContaining({ source_id: 1, success: true, title: 'Fetched AI Source' }),
      ],
    });
    expect(insertRun).toHaveBeenCalledTimes(1);
    expect(info.mock.calls.flat().join('\n')).toContain('subscription-crawl');
    expect(info.mock.calls.flat().join('\n')).toContain('request_completed');
  });
});
