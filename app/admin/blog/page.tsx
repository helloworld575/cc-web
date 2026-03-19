'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Pagination from '@/components/Pagination';

interface PostMeta { slug: string; title: string; date: string; }
const PAGE_SIZE = 20;

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const router = useRouter();

  useEffect(() => { fetch('/api/blog').then(r => r.json()).then(setPosts); }, []);

  async function createPost() {
    if (!slug || !title) return;
    setError('');
    const res = await fetch('/api/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, title, date: new Date().toISOString().slice(0, 10), content: '' }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? 'Failed to create post');
      return;
    }
    router.push(`/admin/blog/${slug}`);
  }

  async function deletePost(s: string) {
    await fetch(`/api/blog/${s}`, { method: 'DELETE' });
    setPosts(posts.filter(p => p.slug !== s));
  }

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Admin — Blog</h1>
      <div className="flex gap-2 mb-2">
        <input placeholder="slug (a-z, 0-9, -)" value={slug} onChange={e => setSlug(e.target.value)} className="border rounded px-2 py-1 flex-1" />
        <input placeholder="title" value={title} onChange={e => setTitle(e.target.value)} className="border rounded px-2 py-1 flex-1"
          onKeyDown={e => e.key === 'Enter' && createPost()} />
        <button onClick={createPost} className="bg-black text-white px-3 py-1 rounded">New</button>
      </div>
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search posts..."
        className="w-full border rounded px-3 py-2 my-4 text-sm" />
      <ul className="space-y-3">
        {paged.map(p => (
          <li key={p.slug} className="flex items-center gap-3">
            <Link href={`/admin/blog/${p.slug}`} className="underline flex-1">{p.title}</Link>
            <span className="text-sm text-gray-400">{p.date}</span>
            <button onClick={() => deletePost(p.slug)} className="text-red-500 text-sm">Delete</button>
          </li>
        ))}
      </ul>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
