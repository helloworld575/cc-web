import { describe, it, expect, vi } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';
import db from '@/lib/db';

describe('GET /api/subscriptions/briefs', () => {
  it('returns stored briefs without requiring a session', async () => {
    mockSession(false);
    mockDbStmt({
      all: vi.fn(() => [
        {
          id: 1, source_id: 1, source_name: 'My Blog', category: 'blog',
          title: 'Public Brief', url: 'https://example.com/post', brief: 'Brief text',
          fetched_at: '2024-01-01 00:00:00',
        },
      ]),
    });
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].title).toBe('Public Brief');
  });

  it('returns all briefs', async () => {
    mockSession(true);
    mockDbStmt({
      all: vi.fn(() => [
        {
          id: 1, source_id: 1, source_name: 'My Blog', category: 'blog',
          title: 'Test Post', url: 'https://example.com/post', brief: 'Brief text',
          fetched_at: '2024-01-01 00:00:00',
        },
      ]),
    });
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Test Post');
  });

  it('returns the AI or security topic separately from the fetch category', async () => {
    mockSession(false);
    const all = vi.fn(() => [{
      id: 2,
      source_id: 4,
      source_name: 'CISA',
      category: 'rss',
      topic: 'security',
      title: 'Advisory',
      url: 'https://www.cisa.gov/example',
      brief: 'Facts',
      fetched_at: '2026-07-16 00:00:00',
    }]);
    vi.mocked(db.prepare).mockImplementation(((sql: string) => {
      expect(sql).toContain('s.topic');
      return { all };
    }) as never);

    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const response = await GET(new Request('http://localhost/api/subscriptions/briefs'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ category: 'rss', topic: 'security' }),
    ]);
  });

  it('filters by source_id', async () => {
    mockSession(true);
    mockDbStmt({
      all: vi.fn(() => [
        {
          id: 1, source_id: 1, source_name: 'My Blog', category: 'blog',
          title: 'Test Post', url: 'https://example.com/post', brief: 'Brief text',
          fetched_at: '2024-01-01 00:00:00',
        },
      ]),
    });
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs?source_id=1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it('rejects a non-integer source_id', async () => {
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs?source_id=1x'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid source_id' });
  });

  it('rejects a non-integer limit', async () => {
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs?limit=12x'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid limit' });
  });

  it.each([
    ['-5', 1],
    ['500', 100],
  ])('clamps limit=%s to %i', async (requestedLimit, expectedLimit) => {
    const all = vi.fn(() => []);
    mockDbStmt({ all });
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request(`http://localhost/api/subscriptions/briefs?limit=${requestedLimit}`));

    expect(res.status).toBe(200);
    expect(all).toHaveBeenCalledWith(expectedLimit);
  });
});

describe('DELETE /api/subscriptions/briefs', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/subscriptions/briefs/route');
    const res = await DELETE(new Request('http://localhost/api/subscriptions/briefs?id=1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 without id', async () => {
    mockSession(true);
    const { DELETE } = await import('@/app/api/subscriptions/briefs/route');
    const res = await DELETE(new Request('http://localhost/api/subscriptions/briefs'));
    expect(res.status).toBe(400);
  });

  it('deletes brief', async () => {
    mockSession(true);
    mockDbStmt();
    const { DELETE } = await import('@/app/api/subscriptions/briefs/route');
    const res = await DELETE(new Request('http://localhost/api/subscriptions/briefs?id=1'));
    expect(res.status).toBe(200);
  });
});
