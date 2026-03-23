'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { notFound } from 'next/navigation';
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

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLocale();

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setPost(data); setLoading(false); });
  }, [slug]);

  if (loading) return <main className="max-w-2xl mx-auto px-6 py-12"><p className="text-gray-400 text-sm">{t('loading')}</p></main>;
  if (!post) return <main className="max-w-2xl mx-auto px-6 py-12"><p className="text-gray-500">{t('postNotFound')}</p></main>;

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
