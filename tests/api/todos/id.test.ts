import { describe, it, expect, beforeEach } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

const params = { params: { id: '1' } };

describe('GET /api/todos/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/todos/[id]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: () => undefined });
    const { GET } = await import('@/app/api/todos/[id]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(404);
  });

  it('returns 200 with todo', async () => {
    mockSession(true);
    mockDbStmt({ get: () => ({ id: 1, text: 'test', done: 0 }) });
    const { GET } = await import('@/app/api/todos/[id]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/todos/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/todos/[id]/route');
    const res = await PUT(new Request('http://localhost', { method: 'PUT', body: '{}' }), params);
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad JSON', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/todos/[id]/route');
    const res = await PUT(new Request('http://localhost', { method: 'PUT', body: 'bad' }), params);
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    mockDbStmt({ get: () => ({ id: 1, text: 'old', done: 0, deadline: null }) });
    const { PUT } = await import('@/app/api/todos/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ text: 'updated' }),
    }), params);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/todos/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/todos/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    mockDbStmt();
    const { DELETE } = await import('@/app/api/todos/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});
