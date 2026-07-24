import { describe, expect, it } from 'vitest';
import {
  formatBlogDate,
  getBlogCalendarDate,
  orderBlogPosts,
  paginateBlogPosts,
  type BlogListPost,
} from '@/lib/blog-list';

const posts: BlogListPost[] = [
  { slug: 'middle', title: 'Middle', date: '2026-07-09', brief: '' },
  { slug: 'older', title: 'Older', date: '2026-07-08', brief: '' },
  { slug: 'newest', title: 'Newest', date: '2026-07-13', brief: '' },
];

describe('blog list ordering and dates', () => {
  it('orders newest first by default and supports oldest first', () => {
    expect(orderBlogPosts(posts).map(post => post.slug)).toEqual(['newest', 'middle', 'older']);
    expect(orderBlogPosts(posts, 'oldest').map(post => post.slug)).toEqual(['older', 'middle', 'newest']);
  });

  it('paginates only after applying the selected order', () => {
    expect(paginateBlogPosts(orderBlogPosts(posts), 2, 1).map(post => post.slug)).toEqual(['middle']);
  });

  it('formats the canonical date in English and Chinese without timezone drift', () => {
    expect(formatBlogDate('2026-04-23', 'en')).toBe('April 23, 2026');
    expect(formatBlogDate('2026-04-23', 'zh')).toBe('2026年4月23日');
  });

  it('uses the Asia/Shanghai calendar day when creating a new post', () => {
    expect(getBlogCalendarDate(new Date('2026-07-23T16:30:00.000Z'))).toBe('2026-07-24');
    expect(getBlogCalendarDate(new Date('2026-07-24T15:59:59.999Z'))).toBe('2026-07-24');
  });
});
