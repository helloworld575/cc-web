import { describe, it, expect, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, postReq } from '../../../helpers';

describe('GET /api/fortune/history', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/fortune/history/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with docs', async () => {
    mockSession(true);
    mockDbStmt({ all: vi.fn(() => [{ id: 1, method: 'bazi', input: '{}', preflight: '{}', analysis: 'test', created_at: '2025-01-01' }]) });
    const { GET } = await import('@/app/api/fortune/history/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].method).toBe('bazi');
  });
});

describe('POST /api/fortune/history', () => {
  beforeEach(() => { vi.resetModules(); });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    mockSession(true);
    mockDbStmt();
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({ method: 'bazi' }));
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    mockSession(true);
    mockDbStmt({
      run: vi.fn(() => ({ lastInsertRowid: 1, changes: 1 })),
      get: vi.fn(() => ({ id: 1, method: 'bazi', input: '{}', preflight: '{}', analysis: 'test analysis', created_at: '2025-01-01' })),
    });
    const { POST } = await import('@/app/api/fortune/history/route');
    const res = await POST(postReq({ method: 'bazi', input: {}, preflight: {}, analysis: 'test analysis' }));
    expect(res.status).toBe(201);
  });
});
