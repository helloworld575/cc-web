'use client';
import { useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';

interface Todo { id: number; text: string; done: number; }
const PAGE_SIZE = 20;

export default function AdminToolsPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => { fetch('/api/todos').then(r => r.json()).then(setTodos); }, []);

  async function addTodo() {
    if (!text.trim()) return;
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const { id } = await res.json();
    setTodos([{ id, text, done: 0 }, ...todos]);
    setText('');
  }

  async function toggleDone(t: Todo) {
    await fetch(`/api/todos/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t.text, done: !t.done }),
    });
    setTodos(todos.map(x => x.id === t.id ? { ...x, done: x.done ? 0 : 1 } : x));
  }

  async function deleteTodo(id: number) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    setTodos(todos.filter(t => t.id !== id));
  }

  const filtered = todos
    .filter(t => t.text.toLowerCase().includes(search.toLowerCase()))
    .filter(t => filter === 'all' ? true : filter === 'done' ? t.done : !t.done);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Admin — Todos</h1>
      <div className="flex gap-2 mb-4">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="New todo"
          className="border rounded px-2 py-1 flex-1" onKeyDown={e => e.key === 'Enter' && addTodo()} />
        <button onClick={addTodo} className="bg-black text-white px-3 py-1 rounded">Add</button>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
          className="border rounded px-2 py-1 flex-1 text-sm" />
        <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1); }} className="border rounded px-2 py-1 text-sm">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </div>
      <ul className="space-y-2">
        {paged.map(t => (
          <li key={t.id} className="flex items-center gap-3">
            <input type="checkbox" checked={!!t.done} onChange={() => toggleDone(t)} />
            <span className={t.done ? 'line-through text-gray-400 flex-1' : 'flex-1'}>{t.text}</span>
            <button onClick={() => deleteTodo(t.id)} className="text-red-500 text-sm">Delete</button>
          </li>
        ))}
      </ul>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
