import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { savePost } from '@/lib/markdown';
import {
  crawlSubscriptionSources,
  getEnabledSubscriptionSources,
} from '@/lib/subscription-service';
import {
  getShanghaiDayUtcBounds,
  getShanghaiRunDate,
  renderDailySubscriptionPost,
  runDailySubscriptionPublishing,
} from '@/lib/subscription-daily';

vi.mock('@/lib/subscription-service', () => ({
  crawlSubscriptionSources: vi.fn(),
  getEnabledSubscriptionSources: vi.fn(),
}));

describe('daily subscription publishing', () => {
  beforeEach(() => {
    vi.mocked(savePost).mockReset();
    vi.mocked(getEnabledSubscriptionSources).mockReset();
    vi.mocked(crawlSubscriptionSources).mockReset();
  });

  it('uses the Asia/Shanghai calendar date', () => {
    expect(getShanghaiRunDate(new Date('2026-07-15T16:30:00.000Z'))).toBe('2026-07-16');
    expect(getShanghaiDayUtcBounds('2026-07-16')).toEqual({
      start: '2026-07-15T16:00:00.000Z',
      end: '2026-07-16T16:00:00.000Z',
    });
  });

  it('renders factual items with deterministic clickable references', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头编辑判断只能出现在这里。',
      entries: [{
        id: 9,
        source_name: 'CISA',
        source_url: 'https://www.cisa.gov/',
        title: 'Security advisory',
        url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/example',
        excerpt: 'The advisory documents an affected product and mitigation.',
        published_at: '2026-07-15T08:00:00.000Z',
      }],
      summaries: [{ entry_id: 9, summary: 'CISA 发布了受影响产品与缓解措施。' }],
    });

    expect(markdown).toContain('## 片头');
    expect(markdown).toContain('片头编辑判断只能出现在这里。');
    expect(markdown).toContain('[Security advisory](https://www.cisa.gov/news-events/cybersecurity-advisories/example)');
    expect(markdown).toContain('[CISA](https://www.cisa.gov/)');
    expect(markdown).toContain('## 参考信息');
    expect(markdown.match(/https:\/\/www\.cisa\.gov\/news-events\/cybersecurity-advisories\/example/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('ignores model summaries that reference unknown entry ids', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'ai',
      runDate: '2026-07-16',
      intro: '今日片头。',
      entries: [],
      summaries: [{ entry_id: 999, summary: 'Fabricated item.' }],
    });

    expect(markdown).not.toContain('Fabricated item');
    expect(markdown).toContain('没有可核实的新条目');
  });

  it('escapes feed-controlled markdown instead of allowing injected headings or images', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 7,
        source_name: 'Source [official]',
        source_url: 'https://security.example/',
        title: 'Advisory ](https://evil.example)\n# Injected',
        url: 'javascript:alert(1)',
        excerpt: '![tracking](https://evil.example/pixel.png)',
      }],
      summaries: [],
    });

    expect(markdown).not.toContain('(javascript:');
    expect(markdown).not.toContain('\n# Injected');
    expect(markdown).not.toContain('![tracking]');
    expect(markdown).toContain('https://security.example/');
  });

  it('percent-encodes markdown delimiters inside otherwise valid HTTPS URLs', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 8,
        source_name: 'Source',
        source_url: 'https://security.example/',
        title: 'Advisory',
        url: 'https://example.com/a)![x](https://evil.example/p.png)',
        excerpt: 'Facts.',
      }],
      summaries: [],
    });

    expect(markdown).not.toContain('![x]');
    expect(markdown).not.toContain('](https://evil.example');
    expect(markdown).toContain('%29%21%5Bx%5D%28https://evil.example/p.png%29');
  });

  it('publishes each topic once per Shanghai day and does not repeat yesterday entries', async () => {
    vi.mocked(getEnabledSubscriptionSources).mockReturnValue([
      { id: 1, name: 'OpenAI', url: 'https://ai.example/feed.xml', category: 'rss', topic: 'ai', enabled: 1 },
      { id: 2, name: 'CISA', url: 'https://security.example/feed.xml', category: 'rss', topic: 'security', enabled: 1 },
    ]);
    vi.mocked(crawlSubscriptionSources)
      .mockResolvedValueOnce({
        total: 2,
        results: [
          { source_id: 1, success: true, cached: false, title: 'AI', item_count: 1, new_item_count: 1 },
          { source_id: 2, success: false, error: 'Failed to fetch content' },
        ],
      })
      .mockResolvedValue({
        total: 2,
        results: [
          { source_id: 1, success: true, cached: true, title: 'AI', item_count: 1, new_item_count: 0 },
          { source_id: 2, success: true, cached: false, title: 'Security', item_count: 1, new_item_count: 1 },
        ],
      });

    const runs = new Map<string, { status: 'running' | 'published' | 'failed'; slug: string; entry_count: number }>();
    vi.mocked(db.prepare).mockImplementation(((sql: string) => {
      if (sql.includes('INSERT INTO subscription_daily_runs')) {
        return {
          run: vi.fn((runDate: string, topic: string, slug: string) => {
            const key = `${runDate}:${topic}`;
            if (runs.has(key)) return { changes: 0 };
            runs.set(key, { status: 'running', slug, entry_count: 0 });
            return { changes: 1 };
          }),
        };
      }
      if (sql.includes("status = 'running'") && sql.includes("status = 'failed'")) {
        return {
          run: vi.fn((runDate: string, topic: string) => {
            const key = `${runDate}:${topic}`;
            const current = runs.get(key);
            if (current?.status !== 'failed') return { changes: 0 };
            runs.set(key, { ...current, status: 'running' });
            return { changes: 1 };
          }),
        };
      }
      if (sql.includes('FROM subscription_daily_runs')) {
        return {
          get: vi.fn((runDate: string, topic: string) => runs.get(`${runDate}:${topic}`)),
        };
      }
      if (sql.includes('FROM subscription_items i')) {
        return {
          all: vi.fn((topic: string, start: string) => (
            start.startsWith('2026-07-15')
              ? [{
                  id: topic === 'ai' ? 1 : 2,
                  source_name: topic === 'ai' ? 'OpenAI' : 'CISA',
                  source_url: `https://${topic}.example/feed.xml`,
                  title: `${topic} new item`,
                  url: `https://${topic}.example/item`,
                  excerpt: 'Verified factual excerpt.',
                  published_at: '2026-07-16T01:00:00.000Z',
                }]
              : []
          )),
        };
      }
      if (sql.includes("SET status = 'published'")) {
        return {
          run: vi.fn((entryCount: number, runDate: string, topic: string) => {
            const key = `${runDate}:${topic}`;
            const current = runs.get(key)!;
            runs.set(key, { ...current, status: 'published', entry_count: entryCount });
            return { changes: 1 };
          }),
        };
      }
      if (sql.includes("SET status = 'failed'")) {
        return {
          run: vi.fn((...args: string[]) => {
            const [runDate, topic] = args.length === 3 ? args.slice(1) : args;
            const key = `${runDate}:${topic}`;
            const current = runs.get(key)!;
            runs.set(key, { ...current, status: 'failed', entry_count: 0 });
            return { changes: 1 };
          }),
        };
      }
      return { get: vi.fn(), all: vi.fn(() => []), run: vi.fn(() => ({ changes: 1 })) };
    }) as never);

    const now = new Date('2026-07-16T02:00:00.000Z');
    const first = await runDailySubscriptionPublishing({ requestId: 'first', now });
    const retry = await runDailySubscriptionPublishing({ requestId: 'retry', now });
    const duplicate = await runDailySubscriptionPublishing({ requestId: 'duplicate', now });

    expect(first.publications.map(item => item.status)).toEqual(['published', 'failed']);
    expect(first.publications[1]).toMatchObject({ error_code: 'TOPIC_CRAWL_FAILED' });
    expect(retry.publications.map(item => item.status)).toEqual(['published', 'published']);
    expect(duplicate.publications.every(item => item.cached)).toBe(true);
    expect(savePost).toHaveBeenCalledTimes(2);

    await runDailySubscriptionPublishing({
      requestId: 'next-day',
      now: new Date('2026-07-17T02:00:00.000Z'),
    });
    expect(savePost).toHaveBeenCalledTimes(4);
    expect(vi.mocked(savePost).mock.calls[2]?.[3]).toContain('没有可核实的新条目');
    expect(vi.mocked(savePost).mock.calls[2]?.[3]).not.toContain('ai new item');
  });
});
