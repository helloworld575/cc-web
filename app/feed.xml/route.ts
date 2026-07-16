export const runtime = 'nodejs';
export const revalidate = 300;
import { getPosts } from '@/lib/markdown';
import { absoluteUrl, blogUrl, SITE_AUTHOR } from '@/lib/site';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rssDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const value = new Date(`${date}T00:00:00+08:00`);
  return Number.isNaN(value.getTime()) ? '' : value.toUTCString();
}

export async function GET() {
  const posts = getPosts();
  const items = posts.map(post => {
    const url = blogUrl(post.slug);
    const published = rssDate(post.date);
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <description>${escapeXml(post.brief || '')}</description>`,
      published ? `      <pubDate>${published}</pubDate>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');
  const lastBuildDate = posts[0] ? rssDate(posts[0].date) : '';
  const feedUrl = absoluteUrl('/feed.xml');
  const blogHome = absoluteUrl('/blog');
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>ThomasLee 的技术博客</title>',
    `    <link>${escapeXml(blogHome)}</link>`,
    '    <description>AI、软件工程、NAS 与安全实践的中文技术文章。</description>',
    '    <language>zh-CN</language>',
    `    <managingEditor>zhichenli6@gmail.com (${SITE_AUTHOR})</managingEditor>`,
    `    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    lastBuildDate ? `    <lastBuildDate>${lastBuildDate}</lastBuildDate>` : '',
    items,
    '  </channel>',
    '</rss>',
  ].filter(Boolean).join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
