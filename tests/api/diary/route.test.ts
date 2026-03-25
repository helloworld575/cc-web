import { describe, it, expect, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, postReq } from '../../helpers';

describe('GET /api/diary', () => {
  beforeEach(() => mockDbStmt({ all: () => [{ id: 1, date: '2024-01-01', content: 'hi' }] }));

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/diary/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with entries', async () => {
    mockSession(true);
    const { GET } = await import('@/app/api/diary/route');
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe('POST /api/diary', () => {
  beforeEach(() => mockDbStmt());

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/diary/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/diary/route');
    const res = await POST(postReq({ date: '2024-01-01' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/diary/route');
    const res = await POST(postReq({ date: '2024-01-01', content: 'entry' }));
    expect(res.status).toBe(200);
  });
});
