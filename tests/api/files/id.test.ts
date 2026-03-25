import { describe, it, expect, vi } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

const params = { params: { id: '1' } };

describe('DELETE /api/files/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/files/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: () => undefined });
    const { DELETE } = await import('@/app/api/files/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(404);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    mockDbStmt({ get: () => ({ filename: 'abc.jpg' }) });
    const { DELETE } = await import('@/app/api/files/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});
