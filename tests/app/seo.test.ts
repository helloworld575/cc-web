import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { getPost, getPosts } from '@/lib/markdown';

const post = {
  slug: 'seo-post',
  title: '中文 SEO 文章',
  date: '2026-07-16',
  brief: '这是由编辑保存的摘要。',
  views: 0,
  content: '# 中文 SEO 文章\n\n编辑保存的正文。',
};

describe('public SEO routes', () => {
  beforeEach(() => {
    vi.mocked(getPosts).mockReturnValue([post]);
    vi.mocked(getPost).mockReturnValue(post);
  });

  it('publishes only public pages and public blog posts in the sitemap', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    const urls = entries.map(entry => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      'https://thomaslee.site/',
      'https://thomaslee.site/blog',
      'https://thomaslee.site/files',
      'https://thomaslee.site/blog/seo-post',
    ]));
    expect(urls.some(url => /\/admin|\/api|\/tools/.test(url))).toBe(false);
  });

  it('disallows private routes and advertises the sitemap in robots', async () => {
    const robots = (await import('@/app/robots')).default;
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.flatMap(rule => Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow]);

    expect(disallow).toEqual(expect.arrayContaining(['/admin/', '/api/', '/tools', '/login']));
    expect(result.sitemap).toBe('https://thomaslee.site/sitemap.xml');
  });

  it('returns an RSS feed with escaped Chinese title, summary and absolute links', async () => {
    const { GET } = await import('@/app/feed.xml/route');
    const response = await GET();
    const xml = await response.text();

    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(xml).toContain('<title>中文 SEO 文章</title>');
    expect(xml).toContain('<description>这是由编辑保存的摘要。</description>');
    expect(xml).toContain('<link>https://thomaslee.site/blog/seo-post</link>');
    expect(xml).toContain('<pubDate>');
    expect(xml).not.toContain('/admin/');
  });

  it('builds canonical article metadata from the edited post fields', async () => {
    const { generateMetadata } = await import('@/app/blog/[slug]/page');
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: post.slug }) });
    const openGraph = metadata.openGraph as Record<string, unknown>;
    const twitter = metadata.twitter as Record<string, unknown>;

    expect(metadata.title).toBe(post.title);
    expect(metadata.description).toBe(post.brief);
    expect(metadata.alternates?.canonical).toBe('https://thomaslee.site/blog/seo-post');
    expect(openGraph.url).toBe('https://thomaslee.site/blog/seo-post');
    expect(openGraph.publishedTime).toBe('2026-07-16T00:00:00+08:00');
    expect(twitter.card).toBe('summary');
  });

  it('builds BlogPosting JSON-LD from the edited title, content and date', async () => {
    const { buildBlogPostingJsonLd } = await import('@/lib/seo');
    const jsonLd = buildBlogPostingJsonLd(post);

    expect(jsonLd).toMatchObject({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.brief,
      datePublished: post.date,
      url: 'https://thomaslee.site/blog/seo-post',
    });
    expect(jsonLd.articleBody).toContain('编辑保存的正文');
  });

  it('advertises the public RSS feed and social card metadata from the root layout', () => {
    const layout = fs.readFileSync('app/layout.tsx', 'utf8');

    expect(layout).toContain("'application/rss+xml': '/feed.xml'");
    expect(layout).toContain("card: 'summary'");
    expect(layout).toContain('SITE_URL');
  });
});
