'use client';
import { useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useLocale } from '@/components/useLocale';

interface Todo { id: number; text: string; done: number; created_at: string; deadline?: string; }
const PAGE_SIZE = 20;

function getUrgency(deadline?: string, done?: number): 'overdue' | 'today' | 'tomorrow' | 'soon' | null {
  if (!deadline || done) return null;
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  if (deadline < today) return 'overdue';
  if (deadline === today) return 'today';
  if (deadline === tomorrow) return 'tomorrow';
  if (deadline <= in3) return 'soon';
  return null;
}

const urgencyBg: Record<string, string> = {
  overdue: 'bg-red-50 border-red-300',
  today: 'bg-orange-50 border-orange-300',
  tomorrow: 'bg-yellow-50 border-yellow-300',
  soon: 'bg-yellow-50 border-yellow-200',
};

const urgencyBadge: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700',
  today: 'bg-orange-100 text-orange-700',
  tomorrow: 'bg-yellow-100 text-yellow-700',
  soon: 'bg-yellow-100 text-yellow-600',
};

const urgencyLabel: Record<string, string> = {
  overdue: 'deadlineOverdue', today: 'deadlineToday', tomorrow: 'deadlineTomorrow', soon: 'deadlineSoon',
};

export default function AdminToolsPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { t } = useLocale();

  useEffect(() => { fetch('/api/todos').then(r => r.ok ? r.json() : Promise.reject()).then(setTodos).catch(() => {}); }, []);

  async function addTodo() {
    if (!text.trim()) return;
    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, deadline: newDeadline || undefined }),
    });
    const { id } = await res.json();
    setTodos([{ id, text, done: 0, created_at: new Date().toISOString(), deadline: newDeadline || undefined }, ...todos]);
    setText('');
    setNewDeadline('');
  }

  async function toggleDone(t: Todo) {
    const res = await fetch(`/api/todos/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !t.done }) });
    if (!res.ok) return;
    setTodos(todos.map(x => x.id === t.id ? { ...x, done: x.done ? 0 : 1 } : x));
  }

  async function setDeadline(t: Todo, deadline: string) {
    const res = await fetch(`/api/todos/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline }) });
    if (!res.ok) return;
    setTodos(todos.map(x => x.id === t.id ? { ...x, deadline: deadline || undefined } : x));
  }

  async function deleteTodo(id: number) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setTodos(todos.filter(t => t.id !== id));
  }

  const filtered = todos
    .filter(todo => todo.text.toLowerCase().includes(search.toLowerCase()))
    .filter(todo => filter === 'all' ? true : filter === 'done' ? todo.done : !todo.done)
    .filter(todo => {
      const d = todo.created_at?.slice(0, 10) ?? '';
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t('adminTodos')}</h1>

      {/* Add todo */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="New todo"
          className="border rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
          onKeyDown={e => e.key === 'Enter' && addTodo()} />
        <div className="flex gap-2">
          <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
            className="border rounded-lg px-2 py-2 text-sm text-gray-500 flex-1 sm:w-36" />
          <button onClick={addTodo} className="bg-black text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap">Add</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
          className="border rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
        <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1); }}
          className="border rounded-lg px-2 py-2 text-sm">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </div>
      <DateRangeFilter from={from} to={to} onFrom={v => { setFrom(v); setPage(1); }} onTo={v => { setTo(v); setPage(1); }} onReset={() => { setFrom(''); setTo(''); setPage(1); }} />

      <ul className="space-y-2">
        {paged.map(todo => {
          const urgency = getUrgency(todo.deadline, todo.done);
          return (
            <li key={todo.id} className={`border rounded-lg px-3 py-2.5 ${urgency ? urgencyBg[urgency] : ''}`}>
              {/* Main row */}
              <div className="flex items-start gap-2.5">
                <input type="checkbox" checked={!!todo.done} onChange={() => toggleDone(todo)} className="mt-0.5 shrink-0 w-4 h-4 cursor-pointer" />
                <span className={`flex-1 text-sm leading-snug ${todo.done ? 'line-through text-gray-400' : ''}`}>{todo.text}</span>
                {urgency && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${urgencyBadge[urgency]}`}>
                    {t(urgencyLabel[urgency] as any)}
                  </span>
                )}
              </div>
              {/* Meta row */}
              <div className="flex items-center gap-2 mt-2 ml-6">
                <input type="date" value={todo.deadline ?? ''} onChange={e => setDeadline(todo, e.target.value)}
                  className="border rounded px-1.5 py-0.5 text-xs text-gray-500 flex-1 min-w-0 bg-white" />
                <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{todo.created_at?.slice(0, 10)}</span>
                <button onClick={() => deleteTodo(todo.id)} className="text-red-500 text-xs shrink-0 hover:text-red-700">{t('delete')}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
