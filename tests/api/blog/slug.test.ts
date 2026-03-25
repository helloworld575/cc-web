import { describe, it, expect, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { getPost, savePost, deletePost } from '@/lib/markdown';

const params = { params: { slug: 'hello' } };

describe('GET /api/blog/[slug]', () => {
  it('returns 400 on bad slug', async () => {
    const { GET } = await import('@/app/api/blog/[slug]/route');
    const res = await GET(new Request('http://localhost'), { params: { slug: 'BAD!' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    (getPost as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const { GET } = await import('@/app/api/blog/[slug]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(404);
  });

  it('returns 200 with post', async () => {
    (getPost as ReturnType<typeof vi.fn>).mockReturnValue({ slug: 'hello', title: 'Hello', date: '', brief: '', content: 'hi' });
    const { GET } = await import('@/app/api/blog/[slug]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/blog/[slug]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/blog/[slug]/route');
    const res = await PUT(new Request('http://localhost', { method: 'PUT', body: '{}' }), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/blog/[slug]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ title: 'T', date: '2024-01-01', content: 'c' }),
    }), params);
    expect(res.status).toBe(200);
    expect(savePost).toHaveBeenCalled();
  });
});

describe('DELETE /api/blog/[slug]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/blog/[slug]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { DELETE } = await import('@/app/api/blog/[slug]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
    expect(deletePost).toHaveBeenCalled();
  });
});
