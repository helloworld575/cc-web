import { getPost, getPosts } from '@/lib/markdown';
import { notFound } from 'next/navigation';
import PostClient from './PostClient';

export const revalidate = 60;

export async function generateStaticParams() {
  const posts = getPosts();
  return posts.map(p => ({ slug: p.slug }));
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();
  return <PostClient post={post} />;
}
