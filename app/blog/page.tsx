'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Pagination from '@/components/Pagination';

interface PostMeta { slug: string; title: string; date: string; }
const PAGE_SIZE = 10;

export default function BlogPage() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { fetch('/api/blog').then(r => r.json()).then(setPosts); }, []);

  const filtered = posts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Blog</h1>
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search posts..."
        className="w-full border rounded px-3 py-2 mb-6 text-sm"
      />
      {paged.length === 0 && <p className="text-gray-500">No posts found.</p>}
      <ul className="space-y-4">
        {paged.map(p => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="text-lg underline">{p.title}</Link>
            <p className="text-sm text-gray-500">{p.date}</p>
          </li>
        ))}
      </ul>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}

