'use client';
import { useState } from 'react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';

interface PostMeta { slug: string; title: string; date: string; brief: string; }
const PAGE_SIZE = 10;

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function BlogClient({ posts }: { posts: PostMeta[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { t } = useLocale();

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.brief ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-3xl mx-auto px-6 py-14 fade-in">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-1">{t('blogTitle')}</h1>
        <p className="text-sm text-gray-400">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="relative mb-8">
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

      {paged.length === 0 && (
        <p className="text-gray-400 text-sm py-12 text-center">{t('noPosts')}</p>
      )}

      <ul className="divide-y">
        {paged.map((p, i) => (
          <li key={p.slug} className="group py-7 fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
            <time className="text-xs font-medium text-gray-400 uppercase tracking-widest">{fmtDate(p.date)}</time>
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
