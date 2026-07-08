import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { getPosts } from '@/lib/markdown';
import { mockSession } from '../../helpers';

beforeEach(() => {
  vi.clearAllMocks();
  (getPosts as ReturnType<typeof vi.fn>).mockReturnValue([
    { slug: 'hello', title: 'Hello', date: '2026-07-08', brief: '' },
    { slug: 'quiet', title: 'Quiet Post', date: '2026-07-07', brief: '' },
  ]);
});

describe('GET /api/admin/blog-analytics', () => {
  it('requires admin session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/admin/blog-analytics/route');
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('returns aggregate views, sources, and recent comments', async () => {
    mockSession(true);
    vi.mocked(db.prepare)
      .mockReturnValueOnce({ get: vi.fn(() => ({ views: 42 })) } as any)
      .mockReturnValueOnce({ all: vi.fn(() => [{ slug: 'hello', views: 10, latest_viewed_at: '2026-07-08 10:00:00' }]) } as any)
      .mockReturnValueOnce({ all: vi.fn(() => [{ slug: 'hello', comments: 2 }]) } as any)
      .mockReturnValueOnce({ all: vi.fn(() => [{ source: 'x.com', views: 8 }]) } as any)
      .mockReturnValueOnce({ all: vi.fn(() => [{ slug: 'hello', source: 'x.com', referrer: 'https://x.com/a', created_at: '2026-07-08 10:00:00' }]) } as any)
      .mockReturnValueOnce({ all: vi.fn(() => [{ id: 1, slug: 'hello', author: 'Reader', content: 'Nice', created_at: '2026-07-08 10:01:00' }]) } as any);

    const { GET } = await import('@/app/api/admin/blog-analytics/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalViews).toBe(42);
    expect(data.posts).toEqual([
      { slug: 'hello', title: 'Hello', date: '2026-07-08', views: 10, comments: 2, latestViewedAt: '2026-07-08 10:00:00' },
      { slug: 'quiet', title: 'Quiet Post', date: '2026-07-07', views: 0, comments: 0, latestViewedAt: null },
    ]);
    expect(data.sources).toEqual([{ source: 'x.com', views: 8 }]);
    expect(data.recentComments[0].content).toBe('Nice');
  });
});
