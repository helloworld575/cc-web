'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import MarkdownEditor from '@/components/MarkdownEditor';
import Pagination from '@/components/Pagination';
import DateRangeFilter from '@/components/DateRangeFilter';

interface DiaryEntry { id: number; date: string; content: string; }
const PAGE_SIZE = 10;

export default function AdminDiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { fetch('/api/diary').then(r => r.ok ? r.json() : Promise.reject()).then(setEntries).catch(() => {}); }, []);

  async function save() {
    if (editing) {
      const res = await fetch(`/api/diary/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content }),
      });
      if (!res.ok) { alert('Save failed'); return; }
      setEntries(entries.map(e => e.id === editing.id ? { ...e, date, content } : e));
      setEditing(null);
    } else {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, content }),
      });
      if (!res.ok) { alert('Save failed'); return; }
      const { id } = await res.json();
      setEntries([{ id, date, content }, ...entries]);
    }
    setContent('');
    setDate(new Date().toISOString().slice(0, 10));
  }

  function startEdit(e: DiaryEntry) {
    setEditing(e);
    setDate(e.date);
    setContent(e.content);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteEntry(id: number) {
    const res = await fetch(`/api/diary/${id}`, { method: 'DELETE' });
    if (!res.ok) { alert('Delete failed'); return; }
    setEntries(entries.filter(e => e.id !== id));
  }

  const filtered = entries
    .filter(e => e.date.includes(search) || e.content.toLowerCase().includes(search.toLowerCase()))
    .filter(e => {
      if (from && e.date < from) return false;
      if (to && e.date > to) return false;
      return true;
    });
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Admin — Diary</h1>
      <div className="mb-2 flex gap-2 items-center">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded px-2 py-1" />
        <button onClick={save} className="bg-black text-white px-4 py-1 rounded text-sm">{editing ? 'Update' : 'Add'}</button>
        {editing && <button onClick={() => { setEditing(null); setContent(''); }} className="text-sm text-gray-500">Cancel</button>}
      </div>
      <div className="mb-6">
        <MarkdownEditor value={content} onChange={setContent} rows={12} />
      </div>
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search entries..."
        className="w-full border rounded px-3 py-2 mb-4 text-sm" />
      <DateRangeFilter from={from} to={to} onFrom={v => { setFrom(v); setPage(1); }} onTo={v => { setTo(v); setPage(1); }} onReset={() => { setFrom(''); setTo(''); setPage(1); }} />
      <ul className="space-y-4">
        {paged.map(e => (
          <li key={e.id} className="border rounded px-4 py-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-semibold">{e.date}</span>
              <button onClick={() => startEdit(e)} className="text-sm underline">Edit</button>
              <button onClick={() => deleteEntry(e.id)} className="text-sm text-red-500">Delete</button>
            </div>
            <article className="prose prose-sm max-w-none">
              <ReactMarkdown>{e.content}</ReactMarkdown>
            </article>
          </li>
        ))}
      </ul>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
