'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MarkdownEditor from '@/components/MarkdownEditor';

export default function AdminBlogEditor() {
  const { slug } = useParams<{ slug: string }>();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/blog/${slug}`).then(r => r.json()).then(p => {
      setTitle(p.title ?? '');
      setDate(p.date ?? '');
      setContent(p.content ?? '');
    });
  }, [slug]);

  async function save() {
    await fetch(`/api/blog/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date, content }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main className="px-6 py-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="border rounded px-2 py-1 flex-1 text-lg font-semibold" />
        <input value={date} onChange={e => setDate(e.target.value)} placeholder="YYYY-MM-DD" className="border rounded px-2 py-1 w-36" />
        <button onClick={save} className="bg-black text-white px-4 py-1 rounded text-sm">Save</button>
        {saved && <span className="text-green-600 text-sm">Saved!</span>}
      </div>
      <MarkdownEditor value={content} onChange={setContent} rows={28} />
    </main>
  );
}
