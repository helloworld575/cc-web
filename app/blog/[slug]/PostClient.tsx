'use client';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useLocale } from '@/components/useLocale';
import { extractMarkdownHeadings } from '@/lib/markdown-headings';

interface Post { title: string; date: string; content: string; }

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PostClient({ post }: { post: Post }) {
  const { locale, t } = useLocale();
  const headings = extractMarkdownHeadings(post.content);
  const headingQueue = [...headings];
  const tocTitle = locale === 'zh' ? '目录' : 'On this page';

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <Link href="/blog" className="text-sm text-gray-400 hover:text-black mb-6 block">{t('backToBlog')}</Link>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
          <p className="text-sm text-gray-500 mb-8">{t('publishedOn')} {fmtDate(post.date)}</p>
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
