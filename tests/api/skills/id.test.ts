import { describe, it, expect, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { getSkill, saveSkill, deleteSkill } from '@/lib/skills';

const params = { params: { id: 'test-skill' } };

describe('GET /api/skills/[id]', () => {
  it('returns 400 on bad id', async () => {
    const { GET } = await import('@/app/api/skills/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: { id: 'BAD!' } });
    expect(res.status).toBe(400);
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { GET } = await import('@/app/api/skills/[id]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 with skill', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'test-skill', name: 'Test' });
    const { GET } = await import('@/app/api/skills/[id]/route');
    const res = await GET(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/skills/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { PUT } = await import('@/app/api/skills/[id]/route');
    const res = await PUT(new Request('http://localhost', { method: 'PUT', body: '{}' }), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { PUT } = await import('@/app/api/skills/[id]/route');
    const res = await PUT(new Request('http://localhost', {
      method: 'PUT', body: JSON.stringify({ name: 'Updated', prompt: 'p', output: 'o', description: 'd' }),
    }), params);
    expect(res.status).toBe(200);
    expect(saveSkill).toHaveBeenCalled();
  });
});

describe('DELETE /api/skills/[id]', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { DELETE } = await import('@/app/api/skills/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { DELETE } = await import('@/app/api/skills/[id]/route');
    const res = await DELETE(new Request('http://localhost'), params);
    expect(res.status).toBe(200);
    expect(deleteSkill).toHaveBeenCalled();
  });
});
