'use client';
import { type FormEvent, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useLocale } from '@/components/useLocale';
import { extractMarkdownHeadings } from '@/lib/markdown-headings';

interface Post { slug: string; title: string; date: string; content: string; views?: number; }
interface Comment { id: number; author: string; content: string; created_at: string; }

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PostClient({ post }: { post: Post }) {
  const { locale, t } = useLocale();
  const [views, setViews] = useState(post.views ?? 0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState('');
  const [commentError, setCommentError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const headings = extractMarkdownHeadings(post.content);
  const headingQueue = [...headings];
  const tocTitle = locale === 'zh' ? '目录' : 'On this page';
  const viewsLabel = locale === 'zh' ? '次访问' : 'views';
  const commentsTitle = locale === 'zh' ? '评论' : 'Comments';
  const authorLabel = locale === 'zh' ? '昵称' : 'Name';
  const contentLabel = locale === 'zh' ? '评论内容' : 'Comment';
  const submitLabel = locale === 'zh' ? '提交评论' : 'Post comment';

  useEffect(() => {
    let active = true;

    fetch(`/api/blog/${post.slug}/comments`)
      .then(response => (response.ok ? response.json() : []))
      .then((items: Comment[]) => { if (active) setComments(items); })
      .catch(() => {});

    try {
      const key = `blog-view:${post.slug}`;
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, '1');
        fetch(`/api/blog/${post.slug}/view`, { method: 'POST' })
          .then(response => (response.ok ? response.json() : null))
          .then(data => {
            if (active && typeof data?.views === 'number') setViews(data.views);
          })
          .catch(() => window.sessionStorage.removeItem(key));
      }
    } catch {
      fetch(`/api/blog/${post.slug}/view`, { method: 'POST' })
        .then(response => (response.ok ? response.json() : null))
        .then(data => {
          if (active && typeof data?.views === 'number') setViews(data.views);
        })
        .catch(() => {});
    }

    return () => { active = false; };
  }, [post.slug]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!author.trim() || !content.trim() || submitting) return;

    setSubmitting(true);
    setCommentError('');
    try {
      const response = await fetch(`/api/blog/${post.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content, website }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to post comment.');
      }
      const comment = await response.json();
      if (comment?.id) setComments(items => [...items, comment]);
      setAuthor('');
      setContent('');
      setWebsite('');
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setCommentError(errorLike.message || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/blog" className="text-sm text-gray-400 hover:text-black mb-6 block">{t('backToBlog')}</Link>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
          <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <p>{t('publishedOn')} {fmtDate(post.date)}</p>
            <span data-testid="blog-post-view-count" className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
              {views} {viewsLabel}
            </span>
          </div>
          <article className="prose max-w-none">
            <ReactMarkdown
              components={{
                h2({ children }) {
                  const heading = headingQueue.shift();
                  return (
                    <h2 id={heading?.id} className="scroll-mt-24">
                      {children}
                    </h2>
                  );
                },
                h3({ children }) {
                  const heading = headingQueue.shift();
                  return (
                    <h3 id={heading?.id} className="scroll-mt-24">
                      {children}
                    </h3>
                  );
                },
              }}
            >
              {post.content}
            </ReactMarkdown>
          </article>

          <section data-testid="blog-comments" className="mt-12 border-t border-slate-200 pt-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-slate-900">{commentsTitle}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                {comments.length}
              </span>
            </div>

            <div className="space-y-4">
              {comments.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  {locale === 'zh' ? '还没有评论。' : 'No comments yet.'}
                </p>
              ) : (
                comments.map(comment => (
                  <article key={comment.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{comment.author}</p>
                      <time className="text-xs text-slate-400">{new Date(comment.created_at).toLocaleString()}</time>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{comment.content}</p>
                  </article>
                ))
              )}
            </div>

            <form onSubmit={submitComment} className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                value={author}
                onChange={event => setAuthor(event.target.value)}
                maxLength={80}
                placeholder={authorLabel}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                maxLength={2000}
                rows={4}
                placeholder={contentLabel}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-7 outline-none focus:border-slate-400"
              />
              <input
                value={website}
                onChange={event => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />
              {commentError && <p className="text-sm text-red-600">{commentError}</p>}
              <button
                type="submit"
                disabled={!author.trim() || !content.trim() || submitting}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (locale === 'zh' ? '提交中...' : 'Posting...') : submitLabel}
              </button>
            </form>
          </section>
        </div>

        {headings.length > 0 && (
          <aside data-testid="blog-heading-nav" className="order-first rounded-2xl border border-slate-200 bg-white/85 px-4 py-4 text-sm shadow-sm lg:sticky lg:top-24 lg:order-none">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{tocTitle}</p>
            <nav aria-label={tocTitle} className="mt-3 space-y-2">
              {headings.map(heading => (
                <a
                  key={heading.id}
                  href={`#${encodeURIComponent(heading.id)}`}
                  className={`block rounded-lg px-2 py-1.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 ${
                    heading.depth === 3 ? 'ml-3 text-xs' : 'font-medium'
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </main>
  );
}
