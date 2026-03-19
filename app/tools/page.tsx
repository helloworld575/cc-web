'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import '@uiw/react-markdown-preview/markdown.css';
import Pagination from '@/components/Pagination';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false });

interface Todo { id: number; text: string; done: number; }
interface DiaryEntry { id: number; date: string; content: string; }
const PAGE_SIZE = 10;

export default function ToolsPage() {
  const [tab, setTab] = useState<'todos' | 'diary'>('todos');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [todoSearch, setTodoSearch] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [todoFilter, setTodoFilter] = useState<'all' | 'done' | 'pending'>('all');
  const [todoPage, setTodoPage] = useState(1);
  const [diaryPage, setDiaryPage] = useState(1);

  useEffect(() => {
    fetch('/api/todos').then(r => r.json()).then(setTodos);
    fetch('/api/diary').then(r => r.json()).then(setEntries);
  }, []);

  const filteredTodos = todos
    .filter(t => t.text.toLowerCase().includes(todoSearch.toLowerCase()))
    .filter(t => todoFilter === 'all' ? true : todoFilter === 'done' ? t.done : !t.done);
  const pagedTodos = filteredTodos.slice((todoPage - 1) * PAGE_SIZE, todoPage * PAGE_SIZE);

  const filteredDiary = entries.filter(e =>
    e.date.includes(diarySearch) || e.content.toLowerCase().includes(diarySearch.toLowerCase())
  );
  const pagedDiary = filteredDiary.slice((diaryPage - 1) * PAGE_SIZE, diaryPage * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Tools</h1>
      <div className="flex gap-4 mb-8 border-b">
        <button onClick={() => setTab('todos')} className={`pb-2 text-sm font-medium ${tab === 'todos' ? 'border-b-2 border-black' : 'text-gray-500'}`}>To-Do List</button>
        <button onClick={() => setTab('diary')} className={`pb-2 text-sm font-medium ${tab === 'diary' ? 'border-b-2 border-black' : 'text-gray-500'}`}>Diary</button>
      </div>

      {tab === 'todos' && (
        <>
          <div className="flex gap-2 mb-4">
            <input value={todoSearch} onChange={e => { setTodoSearch(e.target.value); setTodoPage(1); }} placeholder="Search todos..." className="border rounded px-3 py-1 text-sm flex-1" />
            <select value={todoFilter} onChange={e => { setTodoFilter(e.target.value as any); setTodoPage(1); }} className="border rounded px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="done">Done</option>
            </select>
          </div>
          {pagedTodos.length === 0 && <p className="text-gray-500">No todos found.</p>}
          <ul className="space-y-2">
            {pagedTodos.map(t => (
              <li key={t.id} className={`flex items-center gap-2 ${t.done ? 'line-through text-gray-400' : ''}`}>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
          <Pagination total={filteredTodos.length} page={todoPage} pageSize={PAGE_SIZE} onPage={setTodoPage} />
        </>
      )}

      {tab === 'diary' && (
        <>
          <input value={diarySearch} onChange={e => { setDiarySearch(e.target.value); setDiaryPage(1); }} placeholder="Search by date or content..." className="w-full border rounded px-3 py-2 mb-4 text-sm" />
          {pagedDiary.length === 0 && <p className="text-gray-500">No entries found.</p>}
          <ul className="space-y-4">
            {pagedDiary.map(e => (
              <li key={e.id} className="border rounded px-4 py-3">
                <p className="font-semibold mb-2">{e.date}</p>
                <MarkdownPreview source={e.content} className="!bg-transparent !text-sm" />
              </li>
            ))}
          </ul>
          <Pagination total={filteredDiary.length} page={diaryPage} pageSize={PAGE_SIZE} onPage={setDiaryPage} />
        </>
      )}
    </main>
  );
}
