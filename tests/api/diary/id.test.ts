import { describe, it, expect, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, postReq } from '../../helpers';

const params = { params: { id: '1' } };

describe('PUT /api/diary/[id]', () => {
  beforeEach(() => mockDbStmt());

  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/diary/[id]/route');
    const res = await PUT(postReq({}), params);
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/diary/[id]/route');
    const res = await PUT(postReq('bad'), params);
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/diary/[id]/route');
    const res = await PUT(postReq({ date: '2024-01-01', content: 'updated' }), params);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/diary/[id]', () => {
  beforeEach(() => mockDbStmt());

  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/diary/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { DELETE } = await import('@/app/api/diary/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});
