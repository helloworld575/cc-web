import type { Post } from '@/lib/markdown';
import { blogUrl, SITE_AUTHOR, SITE_NAME, SITE_URL } from '@/lib/site';

export function blogPublishedTime(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date}T00:00:00+08:00`
    : undefined;
}

export function markdownToPlainText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildBlogPostingJsonLd(post: Pick<Post, 'slug' | 'title' | 'date' | 'brief' | 'content'>) {
  const url = blogUrl(post.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.brief,
    articleBody: markdownToPlainText(post.content),
    datePublished: post.date,
    inLanguage: 'zh-CN',
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: SITE_AUTHOR, url: SITE_URL },
    publisher: { '@type': 'Person', name: SITE_AUTHOR, url: SITE_URL },
    isPartOf: { '@type': 'Blog', name: SITE_NAME, url: `${SITE_URL}/blog` },
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
