import { getPost, getPosts } from '@/lib/markdown';
import { notFound } from 'next/navigation';
import PostClient from './PostClient';

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = getPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  return <PostClient post={post} />;
}
