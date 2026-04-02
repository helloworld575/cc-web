'use client';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { useLocale } from '@/components/useLocale';

interface Post { title: string; date: string; content: string; }

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  if (!y) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PostClient({ post }: { post: Post }) {
  const { t } = useLocale();

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/blog" className="text-sm text-gray-400 hover:text-black mb-6 block">{t('backToBlog')}</Link>
      <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
      <p className="text-sm text-gray-500 mb-8">{t('publishedOn')} {fmtDate(post.date)}</p>
      <article className="prose max-w-none">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </article>
    </main>
  );
}
