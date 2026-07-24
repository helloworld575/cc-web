import { describe, expect, it } from 'vitest';
import {
  parseSubscriptionFeed,
  parseSubscriptionJsonPayload,
} from '@/.codex/skills/subscription/scripts/fetch-content';

describe('subscription feed parsing', () => {
  it('preserves exact RSS item links and publication dates', () => {
    const parsed = parseSubscriptionFeed(`
      <rss><channel><title>Security Feed</title>
        <item>
          <guid>advisory-1</guid>
          <title><![CDATA[Critical advisory]]></title>
          <link>https://security.example/advisories/1</link>
          <pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate>
          <description><![CDATA[<p>A concrete security update&#8217;s details.</p>]]></description>
        </item>
      </channel></rss>
    `, 'https://security.example/feed.xml');

    expect(parsed.items).toEqual([
      expect.objectContaining({
        external_id: 'advisory-1',
        title: 'Critical advisory',
        url: 'https://security.example/advisories/1',
        date: '2026-07-15T08:00:00.000Z',
        text: 'A concrete security update’s details.',
      }),
    ]);
  });

  it('supports direct Atom feeds and resolves relative entry links', () => {
    const parsed = parseSubscriptionFeed(`
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>AI Research</title>
        <entry>
          <id>tag:example,2026:post-2</id>
          <title>New research result</title>
          <link rel="alternate" href="/posts/2" />
          <updated>2026-07-16T01:02:03Z</updated>
          <summary>Measured findings only.</summary>
        </entry>
      </feed>
    `, 'https://ai.example/atom.xml');

    expect(parsed.items?.[0]).toMatchObject({
      external_id: 'tag:example,2026:post-2',
      url: 'https://ai.example/posts/2',
      date: '2026-07-16T01:02:03.000Z',
    });
  });

  it('rejects non-http entry links instead of publishing executable URLs', () => {
    const parsed = parseSubscriptionFeed(`
      <rss><channel><title>Unsafe Feed</title>
        <item>
          <title>Unsafe item</title>
          <link>javascript:alert(1)</link>
          <description>Do not preserve the unsafe scheme.</description>
        </item>
      </channel></rss>
    `, 'https://security.example/feed.xml');

    expect(parsed.items?.[0]?.url).toBe('https://security.example/feed.xml');
  });

  it('parses public JSON list payloads and constructs official Chaitin links', () => {
    const parsed = parseSubscriptionJsonPayload(JSON.stringify({
      data: {
        list: [{
          id: 323,
          title: '安全公告',
          content: '漏洞影响范围与修复建议。',
          created_time: '2026-07-23T12:00:00+08:00',
        }],
      },
    }), 'https://stack.chaitin.com/api/v2/blog/list/?limit=20');

    expect(parsed?.items?.[0]).toMatchObject({
      external_id: '323',
      title: '安全公告',
      text: '漏洞影响范围与修复建议。',
      url: 'https://stack.chaitin.com/techblog/detail/323',
      date: '2026-07-23T04:00:00.000Z',
    });
  });

  it('extracts Next data without publishing the surrounding HTML shell', () => {
    const parsed = parseSubscriptionJsonPayload(
      '<html><script id="__NEXT_DATA__" type="application/json">'
        + JSON.stringify({ pageProps: { blogList: [{ id: 35, title: '威胁研究', subDesc: '事实摘要', time: '2026-07-22T12:00:00' }] } })
        + '</script><body>导航与脚本</body></html>',
      'https://www.threatbook.cn/techblog',
    );

    expect(parsed?.items?.[0]).toMatchObject({
      external_id: '35',
      title: '威胁研究',
      text: '事实摘要',
      url: 'https://www.threatbook.cn/techBlogInfo/35',
    });
    expect(parsed?.content).not.toContain('导航与脚本');
  });
});
