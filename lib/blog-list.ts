export type BlogSortOrder = 'newest' | 'oldest';

export interface BlogListPost {
  slug: string;
  title: string;
  date: string;
  brief: string;
}

export function orderBlogPosts<T extends BlogListPost>(
  posts: readonly T[],
  order: BlogSortOrder = 'newest'
) {
  const direction = order === 'oldest' ? 1 : -1;

  return [...posts].sort((left, right) => {
    const byDate = left.date.localeCompare(right.date);
    if (byDate !== 0) return byDate * direction;
    return left.slug.localeCompare(right.slug) * direction;
  });
}

export function paginateBlogPosts<T>(posts: readonly T[], page: number, pageSize: number) {
  const start = Math.max(0, page - 1) * pageSize;
  return posts.slice(start, start + pageSize);
}

export function formatBlogDate(date: string, locale: 'en' | 'zh') {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;

  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) return date;

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
