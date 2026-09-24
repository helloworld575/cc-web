import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { mockSession } from '../../helpers';

describe('GET /api/workbench/summary', () => {
  beforeEach(() => {
    mockSession(false);
    vi.mocked(db.prepare).mockReset();
    delete process.env.SECURITY_API_URL;
    delete process.env.SECURITY_API_KEY;
  });

  it('requires an authenticated session', async () => {
    const { GET } = await import('@/app/api/workbench/summary/route');
    const response = await GET(new Request('http://localhost/api/workbench/summary'));

    expect(response.status).toBe(401);
  });

  it('returns a compact work snapshot without transcript or secret fields', async () => {
    mockSession(true);
    const today = { get: vi.fn(() => ({ open: 3, overdue: 1, due_today: 1 })) };
    const tasks = {
      all: vi.fn(() => [{ id: 4, text: 'Prepare review', done: 0, deadline: '2026-09-24', created_at: '2026-09-20' }]),
    };
    const chats = {
      all: vi.fn(() => [{ id: 8, title: 'Refactor agent flow', skill_id: 'investigation-first', provider_name: 'Claude', provider_model: 'claude-opus', status: 'idle', updated_at: '2026-09-23' }]),
    };
    const claude = {
      all: vi.fn(() => [{ id: 12, title: 'Fix route tests', status: 'idle', updated_at: '2026-09-22' }]),
    };

    vi.mocked(db.prepare).mockImplementation((sql: string) => {
      if (sql.includes('AS due_today')) return today as never;
      if (sql.includes('FROM todos')) return tasks as never;
      if (sql.includes('FROM ai_chat_history')) return chats as never;
      if (sql.includes('FROM claude_assistant_sessions')) return claude as never;
      throw new Error(`Unexpected query: ${sql}`);
    });

    const { GET } = await import('@/app/api/workbench/summary/route');
    const response = await GET(new Request('http://localhost/api/workbench/summary'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      taskCounts: { open: 3, overdue: 1, dueToday: 1 },
      dueTasks: [{ id: 4, text: 'Prepare review', done: 0, deadline: '2026-09-24', created_at: '2026-09-20' }],
      recentAgents: {
        aiChat: [{ id: 8, title: 'Refactor agent flow', skill_id: 'investigation-first', provider_name: 'Claude', provider_model: 'claude-opus', status: 'idle', updated_at: '2026-09-23' }],
        claudeCode: [{ id: 12, title: 'Fix route tests', status: 'idle', updated_at: '2026-09-22' }],
      },
      integrations: { securityConfigured: false },
    });
  });
});
