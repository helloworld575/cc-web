import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { mockSession } from '../../helpers';

describe('/api/claude-code/[id]', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(db.prepare).mockReset();
  });

  it('returns a persisted assistant conversation with parsed messages', async () => {
    mockSession(true);
    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn(() => ({
        id: 3,
        title: 'Plan today',
        cwd: 'default',
        status: 'idle',
        messages: JSON.stringify([{ role: 'user', content: 'Plan today' }]),
      })),
    } as never);

    const { GET } = await import('@/app/api/claude-code/[id]/route');
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: '3' }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 3,
      messages: [{ role: 'user', content: 'Plan today' }],
    });
  });

  it('refuses to delete a running conversation', async () => {
    mockSession(true);
    vi.mocked(db.prepare).mockReturnValue({
      get: vi.fn(() => ({ id: 3, status: 'running' })),
      run: vi.fn(),
    } as never);

    const { DELETE } = await import('@/app/api/claude-code/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: '3' }) });

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ code: 'CLAUDE_CHAT_BUSY' });
  });

  it('deletes an idle conversation', async () => {
    mockSession(true);
    const run = vi.fn(() => ({ changes: 1 }));
    vi.mocked(db.prepare).mockImplementation(((sql: string) => ({
      get: vi.fn(() => sql.includes('SELECT') ? { id: 3, status: 'idle' } : undefined),
      run,
    })) as never);

    const { DELETE } = await import('@/app/api/claude-code/[id]/route');
    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: '3' }) });

    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledWith('3');
  });
});
