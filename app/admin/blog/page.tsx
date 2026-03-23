'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useLocale } from '@/components/useLocale';

interface PostMeta { slug: string; title: string; date: string; brief?: string; }
const PAGE_SIZE = 20;

function fmtDate(d: string) {
  if (!d) return '';
  const parts = d.split('-');
  const m = Number(parts[1]);
  const day = Number(parts[2]);
  if (!m || m < 1 || m > 12) return d;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (!day) return months[m - 1];
  return `${months[m - 1]} ${String(day).padStart(2, '0')}`;
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const router = useRouter();
  const { t } = useLocale();

  useEffect(() => { fetch('/api/blog').then(r => r.json()).then(setPosts); }, []);

  function genSlug() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 7);
    return `${datePart}-${rand}`;
  }

  async function createPost() {
    if (!title.trim()) return;
    setError('');
    const slug = genSlug();
    const res = await fetch('/api/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, date: new Date().toISOString().slice(0, 10), content: '' }),
    });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed'); return; }
    router.push(`/admin/blog/${slug}`);
  }

  async function deletePost(s: string) {
    if (!confirm('Delete this post?')) return;
    await fetch(`/api/blog/${s}`, { method: 'DELETE' });
    setPosts(posts.filter(p => p.slug !== s));
  }

  const filtered = posts
    .filter(p => p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase()))
    .filter(p => {
      if (from && p.date < from) return false;
      if (to && p.date > to) return false;
      return true;
    });
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('adminBlog')}</h1>
        <p className="text-sm text-gray-400 mt-1">{filtered.length} {t('blog').toLowerCase()}</p>
      </div>

      <div className="flex gap-2 mb-5">
        <input placeholder={t('newPostPlaceholder')} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createPost()}
          className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-black/10" />
        <button onClick={createPost}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors whitespace-nowrap">
          {t('newPost')}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('searchPlaceholder')}
          className="w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
      </div>
      <DateRangeFilter from={from} to={to}
        onFrom={v => { setFrom(v); setPage(1); }}
        onTo={v => { setTo(v); setPage(1); }}
        onReset={() => { setFrom(''); setTo(''); setPage(1); }} />

      {/* Mobile cards */}
      <div className="md:hidden space-y-3 mt-2">
        {paged.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">{t('noPosts')}</p>}
        {paged.map(p => (
          <div key={p.slug} className="border rounded-xl p-4">
            <div className="flex justify-between items-start gap-2 mb-1">
              <span className="font-medium leading-snug">{p.title}</span>
              <span className="text-xs text-gray-400 shrink-0 font-mono">{fmtDate(p.date)}</span>
            </div>
            {p.brief && <p className="text-xs text-gray-400 line-clamp-1 mb-3">{p.brief}</p>}
            <div className="flex gap-2 mt-3">
              <Link href={`/admin/blog/${p.slug}`}
                className="flex-1 text-center px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-black hover:text-white transition-colors">
                {t('edit')}
              </Link>
              <Link href={`/blog/${p.slug}`} target="_blank"
                className="px-3 py-1.5 border rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                {t('view')}
              </Link>
              <button onClick={() => deletePost(p.slug)}
                className="px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                {t('del')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-xl overflow-hidden mt-2">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">{t('colTitle')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-20">{t('colDate')}</th>
              <th className="px-4 py-3 font-medium text-gray-500 w-40">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 && (
              <tr><td colSpan={3} className="text-center py-10 text-gray-400">{t('noPosts')}</td></tr>
            )}
            {paged.map(p => (
              <tr key={p.slug} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <span className="font-medium">{p.title}</span>
                  {p.brief && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.brief}</p>}
                  <p className="text-xs text-gray-300 font-mono">{p.slug}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{fmtDate(p.date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <Link href={`/admin/blog/${p.slug}`}
                      className="px-3 py-1 border rounded-md text-xs font-medium hover:bg-black hover:text-white transition-colors">
                      {t('edit')}
                    </Link>
                    <Link href={`/blog/${p.slug}`} target="_blank"
                      className="px-3 py-1 border rounded-md text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                      {t('view')}
                    </Link>
                    <button onClick={() => deletePost(p.slug)}
                      className="px-3 py-1 border border-red-200 rounded-md text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                      {t('del')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
