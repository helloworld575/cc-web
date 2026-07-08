'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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

export default function AdminBlogAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    const response = await fetch('/api/admin/blog-analytics');
    if (!response.ok) {
      setError(`Failed to load analytics: ${response.status}`);
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteComment(comment: RecentComment) {
    if (!window.confirm(`Delete comment by ${comment.author}?`)) return;
    setDeletingId(comment.id);
    try {
      const response = await fetch(`/api/blog/${comment.slug}/comments/${comment.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await load();
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setError(errorLike.message || 'Failed to delete comment.');
    } finally {
      setDeletingId(null);
    }
  }

  const totalComments = data?.posts.reduce((sum, post) => sum + post.comments, 0) ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">Blog Analytics</h1>
          <p className="mt-2 text-sm text-slate-500">Views, referrers, and recent comments across published posts.</p>
        </div>
        <button onClick={load} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {data && (
        <div data-testid="admin-blog-analytics" className="space-y-8">
          <section className="grid gap-4 md:grid-cols-3">
            {[
              ['Total Views', data.totalViews],
              ['Posts', data.posts.length],
              ['Comments', totalComments],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                <p className="mt-3 text-4xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Posts</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Title</th>
                    <th className="py-2 pr-4">Views</th>
                    <th className="py-2 pr-4">Comments</th>
                    <th className="py-2 pr-4">Latest View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.posts.map(post => (
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
                        {post.latestViewedAt ? new Date(post.latestViewedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Sources</h2>
              <div className="mt-4 space-y-3">
                {data.sources.length === 0 ? (
                  <p className="text-sm text-slate-400">No view sources yet.</p>
                ) : data.sources.map(source => (
                  <div key={source.source} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3">
                    <span className="font-mono text-sm text-slate-700">{source.source}</span>
                    <span className="text-sm font-semibold text-slate-900">{source.views}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Recent Views</h2>
              <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                {data.recentViews.length === 0 ? (
                  <p className="text-sm text-slate-400">No recent views.</p>
                ) : data.recentViews.map((view, index) => (
                  <div key={`${view.slug}-${view.created_at}-${index}`} className="rounded-xl bg-slate-50 px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs text-slate-500">{view.slug}</span>
                      <span className="text-xs text-slate-400">{new Date(view.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{view.source}</p>
                    {view.referrer && <p className="mt-1 truncate font-mono text-xs text-slate-400">{view.referrer}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Recent Comments</h2>
            <div className="mt-4 space-y-3">
              {data.recentComments.length === 0 ? (
                <p className="text-sm text-slate-400">No comments yet.</p>
              ) : data.recentComments.map(comment => (
                <div key={comment.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{comment.slug} · {new Date(comment.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => deleteComment(comment)}
                      disabled={deletingId === comment.id}
                      className="text-xs font-medium text-red-500 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{comment.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
