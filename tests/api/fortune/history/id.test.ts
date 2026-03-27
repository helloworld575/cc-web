import { describe, it, expect, beforeEach } from 'vitest';
import { mockSession, mockDbStmt } from '../../../helpers';

describe('GET /api/fortune/history/[id]', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad id', async () => {
    mockSession(true);
    mockDbStmt();
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: 'not-a-number' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns 200 with doc', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => ({ id: 1, method: 'bazi', input: '{}', preflight: '{}', analysis: 'test', created_at: '2025-01-01' })) });
    const { GET } = await import('@/app/api/fortune/history/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/fortune/history/[id]', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/fortune/history/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ run: vi.fn(() => ({ changes: 0 })) });
    const { DELETE } = await import('@/app/api/fortune/history/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    mockDbStmt({ run: vi.fn(() => ({ changes: 1 })) });
    const { DELETE } = await import('@/app/api/fortune/history/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});
