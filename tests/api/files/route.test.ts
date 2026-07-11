import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

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
  it('returns 429 when uploads are rate limited', async () => {
    mockSession(true);
    mockRateLimit429();
    const form = new FormData();
    form.append('file', new File([PNG_BYTES], 'photo.png', { type: 'image/png' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(429);
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

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

  it('returns 400 when the extension does not match image bytes', async () => {
    mockSession(true);
    mockDbStmt();
    const form = new FormData();
    form.append('file', new File(['not-an-image'], 'photo.jpg', { type: 'image/jpeg' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual(expect.objectContaining({ code: 'INVALID_IMAGE' }));
  });

  it('returns 413 before reading an oversized image', async () => {
    mockSession(true);
    mockDbStmt();
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(PNG_BYTES);
    const form = new FormData();
    form.append('file', new File([oversized], 'large.png', { type: 'image/png' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(413);
  });

  it('returns 200 on valid upload', async () => {
    mockSession(true);
    mockDbStmt();
    const form = new FormData();
    form.append('file', new File([PNG_BYTES], 'photo.png', { type: 'image/png' }));
    const { POST } = await import('@/app/api/files/route');
    const res = await POST(new Request('http://localhost/api/files', { method: 'POST', body: form }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({
      ok: true,
      filename: expect.stringMatching(/\.png$/),
      url: expect.stringMatching(/^\/uploads\/.+\.png$/),
    });
  });
});
