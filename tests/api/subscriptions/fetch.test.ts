import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockSession } from '../../helpers';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';
import { fetchByCategory } from '@/lib/fetchers';
import db from '@/lib/db';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('POST /api/subscriptions/fetch', () => {
  beforeEach(() => {
    vi.mocked(rateLimitByIp).mockReturnValue(null);
    vi.mocked(fetchByCategory).mockClear();
    vi.mocked(getSkill).mockReset();
    mockFetch.mockReset();
    process.env.CLAUDE_API_KEY = 'test-claude-key';
    process.env.CLAUDE_MODEL = 'claude-opus-4-8';
    process.env.CLAUDE_API_HOST = 'https://www.rightapi.ai/claude';
  });

  it('returns 401 without session', async () => {
    mockSession(false);
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 when the selected topic skill is not invocable', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources')) {
        return { all: vi.fn(() => [{
          id: 1, name: 'AI Source', url: 'https://ai.example', category: 'rss', topic: 'ai', enabled: 1,
        }]) };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });
    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', { method: 'POST', body: '{}' }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      code: 'subscription_skill_unavailable', topic: 'ai',
    });
    expect(getSkill).toHaveBeenCalledWith('subscription-ai');
  });

  it('acts as a compatibility alias that integrates stored crawl items', async () => {
    mockSession(true);
    (getSkill as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'subscription-ai',
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
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const getSource = vi.fn(() => ({
      id: 1,
      name: 'AI Source',
      url: 'https://example.com/ai',
      category: 'rss',
      topic: 'ai',
      enabled: 1,
    }));
    const getLatestItem = vi.fn(() => ({
      id: 7,
      source_id: 1,
      title: 'Stored crawl',
      url: 'https://example.com/ai',
      content: 'Stored content from daily crawl',
      content_hash: 'stored-hash',
    }));
    const getExistingBrief = vi.fn(() => undefined);
    const insertBrief = vi.fn(() => ({ lastInsertRowid: 10, changes: 1 }));
    (db.prepare as ReturnType<typeof vi.fn>).mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM subscription_sources WHERE id = ? AND enabled = 1')) {
        return { get: getSource };
      }
      if (sql.includes('SELECT * FROM subscription_items')) {
        return { get: getLatestItem };
      }
      if (sql.includes('SELECT id, brief FROM subscription_briefs')) {
        return { get: getExistingBrief };
      }
      if (sql.includes('INSERT INTO subscription_briefs')) {
        return { run: insertBrief };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn() };
    });

    const { POST } = await import('@/app/api/subscriptions/fetch/route');
    const res = await POST(new Request('http://localhost/api/subscriptions/fetch', {
      method: 'POST',
      body: JSON.stringify({ source_id: 1 }),
    }));

    expect(res.status).toBe(200);
    expect(getSkill).toHaveBeenCalledWith('subscription-ai');
    expect(fetchByCategory).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://www.rightapi.ai/claude/v1/messages');
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
    expect(insertBrief).toHaveBeenCalledWith(
      1,
      'Stored crawl',
      'https://example.com/ai',
      'Brief from env provider',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });
});
