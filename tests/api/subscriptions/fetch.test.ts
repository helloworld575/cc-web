import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';
import db from '@/lib/db';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('POST /api/subscriptions/fetch', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    mockFetch.mockReset();
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.CLAUDE_API_HOST = 'https://www.right.codes/claude';
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 when the subscription skill is not invocable', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'subscription',
      name: 'Subscription',
      description: 'Guide only',
      invocable: false,
    });
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: 'Subscription skill is not invocable' });
  });

  it('generates briefs with the env-backed default Claude provider', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'subscription',
      name: 'Subscription',
      description: 'Summarize subscription content',
      invocable: true,
      output: 'content',
      system: 'Summarize clearly',
      prompt: 'Summarize {{source_name}} from {{url}} in {{category}}: {{content}}',
    });
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      content: [{ text: 'Brief from env provider' }],
      model: 'claude-opus-4-8',
    }), { status: 200 }));

    const get = vi.fn()
      .mockReturnValueOnce({
        id: 1,
        name: 'AI Source',
        url: 'https://example.com/ai',
        category: 'rss',
        enabled: 1,
      })
      .mockReturnValueOnce(undefined);
    const all = vi.fn(() => []);
    const run = vi.fn(() => ({ lastInsertRowid: 1, changes: 1 }));
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get, all, run });

    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.right.codes/claude/v1/messages');
    expect(init.headers['x-api-key']).toBe('test-claude-key');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'claude-opus-4-8',
      messages: [
        {
          role: 'user',
          content: [
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('AI Source'),
            }),
          ],
        },
      ],
    });
    expect(run).toHaveBeenCalledWith(
      1,
      'Test',
      'https://example.com/ai',
      'Brief from env provider',
      expect.any(String),
    );
  });
});
