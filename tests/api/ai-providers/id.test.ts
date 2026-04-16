import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSession, mockDbStmt, mockRateLimit429 } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';

describe('GET /api/ai-providers/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns provider with masked key', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'GPT', api_type: 'openai', api_url: 'https://api.openai.com',
        api_key: 'sk-longkey1234', model: 'gpt-4o',
      })),
    });
    const { GET } = await import('@/app/api/ai-providers/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.api_key).toBe('••••1234');
  });
});

describe('PUT /api/ai-providers/[id]', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({}),
    }), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when not found', async () => {
    mockSession(true);
    mockDbStmt({ get: vi.fn(() => undefined) });
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'x', api_url: 'y', model: 'z' }),
    }), { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('updates provider successfully', async () => {
    mockSession(true);
    mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Old', api_type: 'openai', api_url: 'https://old.com',
        api_key: 'sk-original', model: 'gpt-3', system_prompt: '', max_tokens: 4096,
      })),
    });
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New', api_url: 'https://new.com', model: 'gpt-4o' }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });

  it('keeps existing api_key when masked key is sent', async () => {
    mockSession(true);
    const stmt = mockDbStmt({
      get: vi.fn(() => ({
        id: 1, name: 'Old', api_type: 'openai', api_url: 'https://old.com',
        api_key: 'sk-original-secret', model: 'gpt-3', system_prompt: '', max_tokens: 4096,
      })),
    });
    const { PUT } = await import('@/app/api/ai-providers/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'New', api_url: 'https://new.com', model: 'gpt-4o',
        api_key: '••••cret', // masked key
      }),
    }), { params: { id: '1' } });
    expect(res.status).toBe(200);
    // Verify the original key was passed to the update, not the masked one
    expect(stmt.run).toHaveBeenCalled();
    const runArgs = stmt.run.mock.calls[stmt.run.mock.calls.length - 1];
    expect(runArgs[3]).toBe('sk-original-secret');
  });
});

describe('DELETE /api/ai-providers/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/ai-providers/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('deletes provider', async () => {
    mockSession(true);
    mockDbStmt();
    const { DELETE } = await import('@/app/api/ai-providers/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: { id: '1' } });
    expect(res.status).toBe(200);
  });
});
