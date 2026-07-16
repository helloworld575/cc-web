import type { Metadata } from 'next';
import { getPost, getPosts } from '@/lib/markdown';
import { notFound } from 'next/navigation';
import PostClient from './PostClient';
import { blogUrl, SITE_AUTHOR, SITE_NAME } from '@/lib/site';
import { blogPublishedTime, buildBlogPostingJsonLd, serializeJsonLd } from '@/lib/seo';

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = getPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) {
    return {
      title: '文章未找到',
      robots: { index: false, follow: false },
    };
  }

  const canonical = blogUrl(post.slug);
  return {
    title: post.title,
    description: post.brief,
    authors: [{ name: SITE_AUTHOR }],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: SITE_NAME,
      title: post.title,
      description: post.brief,
      locale: 'zh_CN',
      authors: [SITE_AUTHOR],
      publishedTime: blogPublishedTime(post.date),
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description: post.brief,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  return (
    <>
      <script
        id="blog-post-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBlogPostingJsonLd(post)) }}
      />
      <PostClient post={post} />
    </>
  );
}
