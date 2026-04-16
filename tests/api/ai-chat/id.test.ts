import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt } from '../../helpers';

describe('GET /api/ai-chat/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/ai-chat/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { GET } = await import('@/app/api/ai-chat/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns chat with parsed messages', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, provider_id: 1, title: 'Hello',
        messages: JSON.stringify([{ role: 'user', content: 'hi' }]),
      })),
    });
    const { GET } = await import('@/app/api/ai-chat/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('PUT /api/ai-chat/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/ai-chat/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({}),
    }), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { PUT } = await import('@/app/api/ai-chat/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ title: 'x' }),
    }), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('updates chat successfully', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, provider_id: 1, title: 'Old', messages: '[]',
      })),
    });
    const { PUT } = await import('@/app/api/ai-chat/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Updated',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/ai-chat/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/ai-chat/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('deletes chat', async () => {
    mockSession(true);
    mockDbStmt();
    const { DELETE } = await import('@/app/api/ai-chat/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});
