import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { getPost } from '@/lib/markdown';

const params = { params: { slug: 'hello' } };

beforeEach(() => {
  vi.clearAllMocks();
  (getPost as ReturnType<typeof vi.fn>).mockReturnValue({
    slug: 'hello',
    title: 'Hello',
    date: '2026-07-08',
    brief: '',
    content: 'body',
  });
});

describe('POST /api/blog/[slug]/view', () => {
  it('records a public view event and returns the new view count', async () => {
    const insertStmt = { run: vi.fn(() => ({ changes: 1 })) };
    const countStmt = { get: vi.fn(() => ({ views: 12 })) };
    vi.mocked(db.prepare)
      .mockReturnValueOnce(insertStmt as any)
      .mockReturnValueOnce(countStmt as any);

    const { POST } = await import('@/app/api/blog/[slug]/view/route');
    const res = await POST(new Request('http://localhost/api/blog/hello/view', {
      method: 'POST',
      headers: {
        referer: 'https://x.com/someone/status/1',
        'user-agent': 'Playwright',
        'x-forwarded-for': '203.0.113.10',
      },
    }), params);

    expect(res.status).toBe(200);
    expect(insertStmt.run).toHaveBeenCalledWith(
      'hello',
      'https://x.com/someone/status/1',
      'x.com',
      'Playwright',
      expect.stringMatching(/^[a-f0-9]{64}$/)
    );
    await expect(res.json()).resolves.toEqual({ views: 12 });
  });

  it('returns 404 for unknown posts', async () => {
    (getPost as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { POST } = await import('@/app/api/blog/[slug]/view/route');
    const res = await POST(new Request('http://localhost/api/blog/missing/view', { method: 'POST' }), {
      params: { slug: 'missing' },
    });

    expect(res.status).toBe(404);
  });
});
