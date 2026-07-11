'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';

interface PostStats {
  slug: string;
  title: string;
  date: string;
  views: number;
  comments: number;
  latestViewedAt: string | null;
}

interface SourceStats {
  source: string;
  views: number;
}

interface RecentView {
  slug: string;
  source: string;
  referrer: string;
  created_at: string;
}

interface RecentComment {
  id: number;
  slug: string;
  author: string;
  content: string;
  created_at: string;
}

interface AnalyticsData {
  totalViews: number;
  posts: PostStats[];
  sources: SourceStats[];
  recentViews: RecentView[];
  recentComments: RecentComment[];
}

const POSTS_PAGE_SIZE = 10;
const SIDE_PAGE_SIZE = 8;

export default function AdminBlogAnalyticsPage() {
  const { locale, t } = useLocale();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [postPage, setPostPage] = useState(1);
  const [sourcePage, setSourcePage] = useState(1);
  const [viewPage, setViewPage] = useState(1);
  const [commentPage, setCommentPage] = useState(1);

  async function load() {
    setLoading(true);
    setError('');
    const response = await fetch('/api/admin/blog-analytics');
    if (!response.ok) {
      setError(`${t('adminBlogAnalyticsLoadFailed')}: ${response.status}`);
      setLoading(false);
      return;
    }
    setData(await response.json());
    setPostPage(1);
    setSourcePage(1);
    setViewPage(1);
    setCommentPage(1);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteComment(comment: RecentComment) {
    if (!window.confirm(t('adminBlogAnalyticsDeleteConfirm', { author: comment.author }))) return;
    setDeletingId(comment.id);
    try {
      const response = await fetch(`/api/blog/${comment.slug}/comments/${comment.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await load();
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setError(errorLike.message || t('adminBlogAnalyticsDeleteFailed'));
    } finally {
      setDeletingId(null);
    }
  }

  const totalComments = data?.posts.reduce((sum, post) => sum + post.comments, 0) ?? 0;
  const pagedPosts = data?.posts.slice((postPage - 1) * POSTS_PAGE_SIZE, postPage * POSTS_PAGE_SIZE) ?? [];
  const pagedSources = data?.sources.slice((sourcePage - 1) * SIDE_PAGE_SIZE, sourcePage * SIDE_PAGE_SIZE) ?? [];
  const pagedViews = data?.recentViews.slice((viewPage - 1) * SIDE_PAGE_SIZE, viewPage * SIDE_PAGE_SIZE) ?? [];
  const pagedComments = data?.recentComments.slice((commentPage - 1) * SIDE_PAGE_SIZE, commentPage * SIDE_PAGE_SIZE) ?? [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('admin')}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">{t('adminBlogAnalyticsTitle')}</h1>
          <p className="mt-2 text-sm text-slate-500">{t('adminBlogAnalyticsDesc')}</p>
        </div>
        <button onClick={load} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          {t('refresh')}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {data && (
        <div data-testid="admin-blog-analytics" className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              [t('adminBlogAnalyticsTotalViews'), data.totalViews],
              [t('adminBlogAnalyticsPosts'), data.posts.length],
              [t('adminBlogAnalyticsComments'), totalComments],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-3 text-4xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{t('adminBlogAnalyticsPosts')}</h2>
              <span className="text-xs text-slate-400">{data.posts.length}</span>
            </div>
            <div
              data-testid="admin-blog-posts-scroll"
              className="mt-4 overflow-auto pr-1"
              style={{ maxHeight: 'min(520px, calc(100vh - 220px))' }}
            >
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">{t('colTitle')}</th>
                    <th className="py-2 pr-4">{t('adminBlogAnalyticsTotalViews')}</th>
                    <th className="py-2 pr-4">{t('adminBlogAnalyticsComments')}</th>
                    <th className="py-2 pr-4">{t('adminBlogAnalyticsLatestView')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPosts.map(post => (
                    <tr key={post.slug}>
                      <td className="py-3 pr-4">
                        <Link href={`/blog/${post.slug}`} className="font-medium text-slate-900 hover:text-sky-700">
                          {post.title}
                        </Link>
                        <p className="mt-1 font-mono text-xs text-slate-400">{post.slug}</p>
                      </td>
                      <td className="py-3 pr-4">{post.views}</td>
                      <td className="py-3 pr-4">{post.comments}</td>
                      <td className="py-3 pr-4 text-slate-500">
                        {post.latestViewedAt ? new Date(post.latestViewedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div data-testid="admin-blog-posts-pagination">
              <Pagination total={data.posts.length} page={postPage} pageSize={POSTS_PAGE_SIZE} onPage={setPostPage} />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{t('adminBlogAnalyticsSources')}</h2>
                <span className="text-xs text-slate-400">{data.sources.length}</span>
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {data.sources.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('adminBlogAnalyticsNoSources')}</p>
                ) : pagedSources.map(source => (
                  <div key={source.source} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                    <span className="font-mono text-sm text-slate-700">{source.source}</span>
                    <span className="text-sm font-semibold text-slate-900">{source.views}</span>
                  </div>
                ))}
              </div>
              <Pagination total={data.sources.length} page={sourcePage} pageSize={SIDE_PAGE_SIZE} onPage={setSourcePage} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-950">{t('adminBlogAnalyticsRecentViews')}</h2>
                <span className="text-xs text-slate-400">{data.recentViews.length}</span>
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {data.recentViews.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('adminBlogAnalyticsNoViews')}</p>
                ) : pagedViews.map((view, index) => (
                  <div key={`${view.slug}-${view.created_at}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-slate-500">{view.slug}</span>
                      <span className="text-xs text-slate-400">{new Date(view.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{view.source}</p>
                    {view.referrer && <p className="mt-1 truncate font-mono text-xs text-slate-400">{view.referrer}</p>}
                  </div>
                ))}
              </div>
              <Pagination total={data.recentViews.length} page={viewPage} pageSize={SIDE_PAGE_SIZE} onPage={setViewPage} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{t('adminBlogAnalyticsRecentComments')}</h2>
              <span className="text-xs text-slate-400">{data.recentComments.length}</span>
            </div>
            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {data.recentComments.length === 0 ? (
                <p className="text-sm text-slate-400">{t('adminBlogAnalyticsNoComments')}</p>
              ) : pagedComments.map(comment => (
                <div key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{comment.slug} · {new Date(comment.created_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}</p>
                    </div>
                    <button
                      onClick={() => deleteComment(comment)}
                      disabled={deletingId === comment.id}
                      className="text-xs font-medium text-red-500 disabled:opacity-40"
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{comment.content}</p>
                </div>
              ))}
            </div>
            <Pagination total={data.recentComments.length} page={commentPage} pageSize={SIDE_PAGE_SIZE} onPage={setCommentPage} />
          </section>
        </div>
      )}
    </main>
  );
}
