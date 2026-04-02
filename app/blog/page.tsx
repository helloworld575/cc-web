import { getPosts } from '@/lib/markdown';
import BlogClient from './BlogClient';

export const revalidate = 60;

export default function BlogPage() {
  const posts = getPosts();
  return <BlogClient posts={posts} />;
}
