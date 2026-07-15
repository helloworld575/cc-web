'use client';
import { useState } from 'react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';
import {
  formatBlogDate,
  orderBlogPosts,
  paginateBlogPosts,
  type BlogSortOrder,
} from '@/lib/blog-list';

interface PostMeta { slug: string; title: string; date: string; brief: string; views?: number; }
const PAGE_SIZE = 10;

export default function BlogClient({ posts }: { posts: PostMeta[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<BlogSortOrder>('newest');
  const { locale, t } = useLocale();
  const viewLabel = locale === 'zh' ? '次访问' : 'views';

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.brief ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const ordered = orderBlogPosts(filtered, sort);
  const paged = paginateBlogPosts(ordered, page, PAGE_SIZE);

  return (
    <main className="max-w-3xl mx-auto px-6 py-14 fade-in">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-1">{t('blogTitle')}</h1>
        <p className="text-sm text-gray-400">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchPlaceholder')}
            className="w-full border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
        <label className="sr-only" htmlFor="blog-sort">{t('sortBy')}</label>
        <select
          id="blog-sort"
          data-testid="blog-sort"
          value={sort}
          onChange={event => {
            setSort(event.target.value as BlogSortOrder);
            setPage(1);
          }}
          className="rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          <option value="newest">{t('newestFirst')}</option>
          <option value="oldest">{t('oldestFirst')}</option>
        </select>
      </div>

      {paged.length === 0 && (
        <p className="text-gray-400 text-sm py-12 text-center">{t('noPosts')}</p>
      )}

      <ul data-testid="blog-post-list" className="divide-y">
        {paged.map((p, i) => (
          <li key={p.slug} className="group py-7 fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-widest text-gray-400">
              <time dateTime={p.date}>{formatBlogDate(p.date, locale)}</time>
              <span data-testid={`blog-post-views-${p.slug}`} className="rounded-full bg-gray-100 px-2 py-0.5 tracking-normal text-gray-500">
                {p.views ?? 0} {viewLabel}
              </span>
            </div>
            <Link href={`/blog/${p.slug}`} className="block mt-1.5">
              <h2 className="text-xl font-bold leading-snug group-hover:text-gray-600 transition-colors">{p.title}</h2>
            </Link>
            {p.brief && (
              <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{p.brief}</p>
            )}
            <Link href={`/blog/${p.slug}`}
              className="inline-flex items-center gap-1 mt-3 text-xs text-gray-400 hover:text-black transition-colors font-medium">
              {t('readMore')} <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
