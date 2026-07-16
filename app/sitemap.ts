import type { MetadataRoute } from 'next';
import { getPosts } from '@/lib/markdown';
import { absoluteUrl, blogUrl } from '@/lib/site';

export const revalidate = 300;

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/blog'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/files'), changeFrequency: 'weekly', priority: 0.6 },
  ];
  const posts: MetadataRoute.Sitemap = getPosts().map(post => ({
    url: blogUrl(post.slug),
    lastModified: post.date || undefined,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  return [...publicRoutes, ...posts];
}
