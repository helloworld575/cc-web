import { expect, test } from './fixtures';

test('public SEO endpoints expose only public content', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('/blog');
  expect(sitemapText).not.toMatch(/<loc>[^<]*\/(admin|api|tools)(\/|<)/);

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsText = await robots.text();
  expect(robotsText).toContain('Disallow: /admin/');
  expect(robotsText).toContain('Disallow: /api/');
  expect(robotsText).toContain('Sitemap: https://thomaslee.site/sitemap.xml');

  const feed = await request.get('/feed.xml');
  expect(feed.ok()).toBeTruthy();
  expect(feed.headers()['content-type']).toContain('application/rss+xml');
  const feedText = await feed.text();
  expect(feedText).toContain('Seeded Hello');
  expect(feedText).toContain('https://thomaslee.site/blog/seeded-hello');
});

test('public article HTML contains canonical metadata and BlogPosting JSON-LD', async ({ request }) => {
  const response = await request.get('/blog/seeded-hello');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();

  expect(html).toContain('<link rel="canonical" href="https://thomaslee.site/blog/seeded-hello"');
  expect(html).toContain('property="og:type" content="article"');
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"BlogPosting"');
  expect(html).toContain('"headline":"Seeded Hello"');
  expect(html).toContain('"datePublished":"2026-04-30"');
});
