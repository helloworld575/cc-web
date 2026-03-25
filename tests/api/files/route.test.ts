import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

describe('GET /api/files', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/files/route');
    const res = await GET(new Request('http://localhost/api/files'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with files', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn((..._args: unknown[]) => ({ c: 1 })),
      all: vi.fn((..._args: unknown[]) => [{ id: 1, filename: 'a.jpg' }]),
    });
    const { GET } = await import('@/app/api/files/route');
    const res = await GET(new Request('http://localhost/api/files'));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/files', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad extension', async () => {
    mockSession(true);
    mockDbStmt();
    const form = new FormData();
    form.append('file', new File(['data'], 'test.exe', { type: 'application/exe' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(400);
  });

  it('returns 200 on valid upload', async () => {
    mockSession(true);
    mockDbStmt();
    const form = new FormData();
    form.append('file', new File(['data'], 'photo.jpg', { type: 'image/jpeg' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(200);
  });
});
