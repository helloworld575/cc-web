import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mockSession, postReq } from '../../helpers';
import { getPosts, savePost } from '@/lib/markdown';
import { revalidatePath } from 'next/cache';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/blog', () => {
  it('returns 200 with posts (public)', async () => {
    (getPosts as ReturnType<typeof vi.fn>).mockReturnValue([{ slug: 'a', title: 'A', date: '2024-01-01', brief: '' }]);
    const { GET } = await import('@/app/api/blog/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe('POST /api/blog', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/blog/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/blog/route');
    const res = await POST(postReq('bad'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid slug', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/blog/route');
    const res = await POST(postReq({ slug: 'BAD SLUG!', title: 'T', date: '2024-01-01', content: 'c' }));
    expect(res.status).toBe(400);
  });

  it('rejects timestamp dates so published days cannot drift by timezone', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/blog/route');
    const res = await POST(postReq({
      slug: 'timestamp-date',
      title: 'Timestamp date',
      date: '2026-07-17T00:00:00+08:00',
      content: 'content',
    }));

    expect(res.status).toBe(400);
    expect(savePost).not.toHaveBeenCalled();
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/blog/route');
    const res = await POST(postReq({ slug: 'hello', title: 'Hello', date: '2024-01-01', content: 'hi' }));
    expect(res.status).toBe(200);
    expect(savePost).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/blog');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/hello');
  });
});
