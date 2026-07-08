import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { getPost } from '@/lib/markdown';
import { mockSession } from '../../helpers';

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

describe('GET /api/blog/[slug]/comments', () => {
  it('returns visible comments for a public blog post', async () => {
    const stmt = {
      all: vi.fn(() => [
        { id: 1, author: 'Reader', content: 'Useful note', created_at: '2026-07-08 10:00:00' },
      ]),
      get: vi.fn(),
      run: vi.fn(),
    };
    vi.mocked(db.prepare).mockReturnValue(stmt as any);

    const { GET } = await import('@/app/api/blog/[slug]/comments/route');
    const res = await GET(new Request('http://localhost'), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([
      { id: 1, author: 'Reader', content: 'Useful note', created_at: '2026-07-08 10:00:00' },
    ]);
    expect(stmt.all).toHaveBeenCalledWith('hello');
  });
});

describe('POST /api/blog/[slug]/comments', () => {
  it('rejects empty comments', async () => {
    const { POST } = await import('@/app/api/blog/[slug]/comments/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ author: '', content: '' }),
    }), params);

    expect(res.status).toBe(400);
  });

  it('creates a visible comment without requiring login', async () => {
    const insertStmt = { run: vi.fn(() => ({ lastInsertRowid: 7, changes: 1 })) };
    const getStmt = {
      get: vi.fn(() => ({
        id: 7,
        author: 'Reader',
        content: 'This helped.',
        created_at: '2026-07-08 10:00:00',
      })),
    };
    vi.mocked(db.prepare)
      .mockReturnValueOnce(insertStmt as any)
      .mockReturnValueOnce(getStmt as any);

    const { POST } = await import('@/app/api/blog/[slug]/comments/route');
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ author: ' Reader ', content: ' This helped. ' }),
    }), params);

    expect(res.status).toBe(200);
    expect(insertStmt.run).toHaveBeenCalledWith('hello', 'Reader', 'This helped.');
    const data = await res.json();
    expect(data.id).toBe(7);
  });
});

describe('DELETE /api/blog/[slug]/comments/[id]', () => {
  it('requires admin session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/blog/[slug]/comments/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { slug: 'hello', id: '7' } });

    expect(res.status).toBe(401);
  });

  it('deletes a comment for the current slug', async () => {
    mockSession(true);
    const stmt = { run: vi.fn(() => ({ changes: 1 })) };
    vi.mocked(db.prepare).mockReturnValue(stmt as any);

    const { DELETE } = await import('@/app/api/blog/[slug]/comments/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { slug: 'hello', id: '7' } });

    expect(res.status).toBe(200);
    expect(stmt.run).toHaveBeenCalledWith(7, 'hello');
  });
});
