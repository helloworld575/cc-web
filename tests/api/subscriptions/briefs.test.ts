import { describe, it, expect, vi } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

describe('GET /api/subscriptions/briefs', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/subscriptions/briefs/route');
    const res = await GET(new Request('http://localhost/api/subscriptions/briefs'));
    expect(res.status).toBe(401);
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
