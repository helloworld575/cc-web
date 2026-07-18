import { beforeEach, describe, expect, it, vi } from 'vitest';
import db from '@/lib/db';
import { savePost } from '@/lib/markdown';
import {
  crawlSubscriptionSources,
  getEnabledSubscriptionSources,
} from '@/lib/subscription-service';
import {
  extractSecurityFacts,
  getShanghaiDayUtcBounds,
  getShanghaiRunDate,
  renderDailySubscriptionPost,
  runDailySubscriptionPublishing,
} from '@/lib/subscription-daily';
import {
  classifySubscriptionEntry,
  selectBalancedDailyEntries,
} from '@/lib/subscription-content-types';

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
        source_id: 1,
        topic: 'security',
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
    expect(markdown).toContain('[Security advisory](<https://www.cisa.gov/news-events/cybersecurity-advisories/example>)');
    expect(markdown).toContain('[CISA](<https://www.cisa.gov/>)');
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
        source_id: 1,
        topic: 'security',
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

  it('wraps valid HTTPS destinations in CommonMark angle brackets', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 8,
        source_id: 1,
        topic: 'security',
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
    expect(markdown).toContain('[Advisory](<https://example.com/a%29%21%5Bx%5D%28https://evil.example/p.png%29>)');
  });

  it('extracts explicit security facts and never invents missing fields', () => {
    expect(extractSecurityFacts(
      'CVE-2026-12345 远程代码执行漏洞',
      '涉及软件或服务：Example Gateway。受影响版本：2.0 至 2.4。修复或缓解措施：升级至 2.4.1。',
    )).toEqual({
      vulnerabilityId: 'CVE-2026-12345',
      vulnerabilityType: '远程代码执行',
      affectedSoftware: 'Example Gateway',
      affectedVersions: '2.0 至 2.4',
      mitigation: '升级至 2.4.1',
    });

    expect(extractSecurityFacts('安全更新', '原文只说明已发布更新。')).toEqual({
      vulnerabilityId: '原文摘要未明确披露',
      vulnerabilityType: '原文摘要未明确披露',
      affectedSoftware: '原文摘要未明确披露',
      affectedVersions: '原文摘要未明确披露',
      mitigation: '原文摘要未明确披露',
    });
  });

  it('renders vulnerability advisories with vulnerability-specific fields', () => {
    const entry = {
      id: 10,
      source_id: 1,
      topic: 'security' as const,
      source_name: 'Security Source',
      source_url: 'https://security.example/feed.xml',
      title: 'CVE-2026-12345 远程代码执行漏洞',
      url: 'https://security.example/advisory',
      excerpt: '漏洞级别：严重（CVSS 9.8）。涉及软件或服务：Example Gateway。受影响版本：2.0 至 2.4。修复或缓解措施：升级至 2.4.1。',
    };
    const security = renderDailySubscriptionPost({
      topic: 'security', runDate: '2026-07-16', intro: '片头。', entries: [entry], summaries: [],
    });

    for (const expected of [
      '## 漏洞通告',
      '- 漏洞来源：[Security Source]',
      '- 漏洞编号：CVE-2026-12345',
      '- 漏洞级别：严重（CVSS 9.8）',
      '- 漏洞类型：远程代码执行',
      '- 涉及的软件或服务：Example Gateway',
      '- 受影响版本：2.0 至 2.4',
      '- 修复或缓解措施：升级至 2.4.1',
    ]) expect(security).toContain(expected);
  });

  it('renders threat intelligence without forcing vulnerability fields', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 11,
        source_id: 2,
        topic: 'security',
        source_name: '威胁情报中心',
        source_url: 'https://threat.example/feed.xml',
        title: 'APT 组织发起新一轮钓鱼攻击活动',
        url: 'https://threat.example/report',
        excerpt: '威胁主体：Example APT。受影响对象：制造业。IOC/TTP：鱼叉式钓鱼与恶意文档。',
      }],
      summaries: [{ entry_id: 11, summary: '报告披露了针对制造业的钓鱼攻击活动。' }],
    });

    expect(markdown).toContain('## 威胁情报');
    expect(markdown).toContain('- 信息来源：[威胁情报中心]');
    expect(markdown).toContain('- 信息总结：报告披露了针对制造业的钓鱼攻击活动。');
    expect(markdown).toContain('- 威胁主体或攻击活动：Example APT');
    expect(markdown).toContain('- IOC/TTP：鱼叉式钓鱼与恶意文档');
    expect(markdown).not.toContain('漏洞编号');
    expect(markdown).not.toContain('受影响版本');
  });

  it('classifies and renders AI entries with category-specific templates', () => {
    const entries = [
      {
        id: 21, source_id: 21, topic: 'ai' as const, source_name: 'Model Lab', source_url: 'https://model.example',
        title: 'Model X API 正式发布', url: 'https://model.example/release',
        excerpt: '模型或产品：Model X。版本/发布日期：2026-07-16。能力变化：上下文窗口扩展。',
      },
      {
        id: 22, source_id: 22, topic: 'ai' as const, source_name: 'Research Lab', source_url: 'https://research.example',
        title: '新论文发布 benchmark 评测结果', url: 'https://research.example/paper',
        excerpt: '研究主题：长上下文评测。方法与数据：公开数据集。基准结果：准确率 88%。',
      },
      {
        id: 23, source_id: 23, topic: 'ai' as const, source_name: 'GitHub Project', source_url: 'https://github.com/example/project',
        title: '开源框架 v2.0 release', url: 'https://github.com/example/project/releases/tag/v2.0',
        excerpt: '项目/版本：Project v2.0。主要变更：新增批处理。兼容性/迁移要求：需要 Node.js 20。',
      },
    ];
    const markdown = renderDailySubscriptionPost({
      topic: 'ai', runDate: '2026-07-16', intro: '片头。', entries, summaries: [],
    });

    expect(markdown).toContain('## 模型与产品');
    expect(markdown).toContain('- 模型或产品：Model X');
    expect(markdown).toContain('## 研究与评测');
    expect(markdown).toContain('- 基准结果：准确率 88%');
    expect(markdown).toContain('## 开源工程');
    expect(markdown).toContain('- 兼容性/迁移要求：需要 Node.js 20');
    expect(markdown).not.toContain('漏洞编号');
  });

  it('classifies representative security and AI content deterministically', () => {
    expect(classifySubscriptionEntry('security', 'CVE-2026-12345 漏洞通告', '')).toBe('vulnerability');
    expect(classifySubscriptionEntry('security', 'APT 钓鱼攻击活动报告', '')).toBe('threat-intelligence');
    expect(classifySubscriptionEntry('security', '某服务发生数据泄露事件', '')).toBe('security-incident');
    expect(classifySubscriptionEntry(
      'security', 'APT28 利用 CVE-2026-12345 发起钓鱼攻击活动', '',
    )).toBe('threat-intelligence');
    expect(classifySubscriptionEntry(
      'security', '某云服务因 CVE-2026-12345 发生数据泄露事件', '',
    )).toBe('security-incident');
    expect(classifySubscriptionEntry('security', '终端检测与防御实践', '')).toBe('defense-research');
    expect(classifySubscriptionEntry('ai', '新模型 API 发布', '')).toBe('model-product');
    expect(classifySubscriptionEntry('ai', '论文 benchmark 评测', '')).toBe('research-evaluation');
    expect(classifySubscriptionEntry('ai', 'GitHub 开源框架 v2 release', '')).toBe('open-source-engineering');
    expect(classifySubscriptionEntry('ai', '人工智能监管法案生效', '')).toBe('industry-governance');
  });

  it('stops English labeled facts before the next field', () => {
    const markdown = renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 30,
        source_id: 3,
        topic: 'security',
        source_name: 'Vendor',
        source_url: 'https://vendor.example',
        title: 'CVE-2026-9999 security advisory',
        url: 'https://vendor.example/advisory',
        excerpt: 'Severity: Critical. Exploit status: Active. Mitigation: Upgrade now.',
      }],
      summaries: [],
    });

    expect(markdown).toContain('- 漏洞级别：Critical');
    expect(markdown).toContain('- 利用状态：Active');
    expect(markdown).not.toContain('漏洞级别：Critical. Exploit status');
    expect(markdown).not.toContain('利用状态：Active. Mitigation');
  });

  it('rejects entries that do not belong to the requested topic', () => {
    expect(() => renderDailySubscriptionPost({
      topic: 'security',
      runDate: '2026-07-16',
      intro: '片头。',
      entries: [{
        id: 31,
        source_id: 4,
        topic: 'ai',
        source_name: 'AI Source',
        source_url: 'https://ai.example',
        title: 'Model API release',
        url: 'https://ai.example/release',
        excerpt: 'Model release.',
      }],
      summaries: [],
    })).toThrow('Subscription entry topic mismatch');
  });

  it('balances the daily selection so one content type cannot occupy all slots', () => {
    const categories = [
      ...Array.from({ length: 8 }, (_, index) => ({
        id: index + 1, title: `CVE-2026-${1000 + index} 漏洞通告`, excerpt: '',
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        id: index + 20, title: `APT-${index} 威胁攻击活动`, excerpt: '',
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: index + 40, title: `服务 ${index} 数据泄露事件`, excerpt: '',
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: index + 60, title: `检测与防御研究 ${index}`, excerpt: '',
      })),
    ];
    const selected = selectBalancedDailyEntries('security', categories, 12);
    const counts = selected.reduce<Record<string, number>>((acc, entry) => {
      const type = classifySubscriptionEntry('security', entry.title, entry.excerpt);
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    expect(selected).toHaveLength(12);
    expect(counts).toEqual({
      vulnerability: 5,
      'threat-intelligence': 3,
      'security-incident': 2,
      'defense-research': 2,
    });
  });

  it('round-robins sources inside a content category', () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, index) => ({
        id: index + 1,
        source_id: 1,
        title: `CVE-2026-${2000 + index} 严重漏洞 已知遭利用`,
        excerpt: '修复措施：升级。',
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        id: index + 20,
        source_id: 2,
        title: `CVE-2026-${3000 + index} 漏洞`,
        excerpt: '',
      })),
    ];
    const selected = selectBalancedDailyEntries('security', entries, 5);

    expect(selected.map(entry => entry.source_id)).toEqual([1, 2, 1, 2, 1]);
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
                  source_id: topic === 'ai' ? 1 : 2,
                  topic,
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
