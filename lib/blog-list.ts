export type BlogSortOrder = 'newest' | 'oldest';

export interface BlogListPost {
  slug: string;
  title: string;
  date: string;
  brief: string;
}

const BLOG_TIME_ZONE = 'Asia/Shanghai';

export function isCanonicalBlogDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getBlogCalendarDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BLOG_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const calendar = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${calendar.year}-${calendar.month}-${calendar.day}`;
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
  if (!isCanonicalBlogDate(date)) return date;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)!;

  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) return date;

  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}
