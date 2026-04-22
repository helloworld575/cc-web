import { describe, it, expect, vi } from 'vitest';
import { mockSession, postReq } from '../../helpers';
import { findSkills, getSkills, saveSkill } from '@/lib/skills';

describe('GET /api/skills', () => {
  it('returns 200 with skills (public)', async () => {
    (getSkills as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 'a', name: 'A' }]);
    const { GET } = await import('@/app/api/skills/route');
    const res = await GET(new Request('http://localhost/api/skills'));
    expect(res.status).toBe(200);
  });

  it('filters skills when query is present', async () => {
    (findSkills as ReturnType<typeof vi.fn>).mockReturnValue([{ id: 'b', name: 'B' }]);
    const { GET } = await import('@/app/api/skills/route');
    const res = await GET(new Request('http://localhost/api/skills?q=faq'));
    expect(res.status).toBe(200);
    expect(findSkills).toHaveBeenCalledWith('faq');
  });
});

describe('POST /api/skills', () => {
  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/skills/route');
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
  });

  it('returns 400 on bad id', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/skills/route');
    const res = await POST(postReq({ id: 'BAD!', name: 'n', prompt: 'p' }));
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockSession(true);
    const { POST } = await import('@/app/api/skills/route');
    const res = await POST(postReq({ id: 'test', name: 'Test', prompt: 'p', output: 'o', description: 'd' }));
    expect(res.status).toBe(200);
    expect(saveSkill).toHaveBeenCalled();
  });
});
