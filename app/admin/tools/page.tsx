'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import DateRangeFilter from '@/components/DateRangeFilter';
import MarkdownEditor from '@/components/MarkdownEditor';
import { useLocale } from '@/components/useLocale';

interface Todo { id: number; text: string; done: number; created_at: string; deadline?: string; }
const PAGE_SIZE = 20;

function mergeTodos(serverTodos: Todo[], currentTodos: Todo[]) {
  const serverIds = new Set(serverTodos.map(todo => todo.id));
  const currentOnly = currentTodos.filter(todo => !serverIds.has(todo.id));
  return [...currentOnly, ...serverTodos];
}

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { t } = useLocale();

  useEffect(() => {
    fetch('/api/todos')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((serverTodos: Todo[]) => {
        setTodos(currentTodos => mergeTodos(serverTodos, currentTodos));
      })
      .catch(() => {});
  }, []);

  function resetEditor() {
    setEditingId(null);
    setText('');
    setNewDeadline('');
  }

  async function saveTodo() {
    if (!text.trim()) return;
    if (editingId !== null) {
      const res = await fetch(`/api/todos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, deadline: newDeadline || null }),
      });
      if (!res.ok) return;
      setTodos(currentTodos => currentTodos.map(todo => (
        todo.id === editingId ? { ...todo, text, deadline: newDeadline || undefined } : todo
      )));
      resetEditor();
      return;
    }

    const res = await fetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, deadline: newDeadline || undefined }),
    });
    if (!res.ok) return;
    const created = await res.json();
    const fallbackTodo = {
      id: created.id,
      text,
      done: 0,
      created_at: new Date().toISOString(),
      deadline: newDeadline || undefined,
    };
    const nextTodo = {
      ...fallbackTodo,
      ...created,
      deadline: created.deadline ?? undefined,
    };
    setTodos(currentTodos => [nextTodo, ...currentTodos.filter(todo => todo.id !== nextTodo.id)]);
    resetEditor();
  }

  function editTodo(todo: Todo) {
    setEditingId(todo.id);
    setText(todo.text);
    setNewDeadline(todo.deadline ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function toggleDone(t: Todo) {
    const res = await fetch(`/api/todos/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !t.done }) });
    if (!res.ok) return;
    setTodos(currentTodos => currentTodos.map(x => x.id === t.id ? { ...x, done: x.done ? 0 : 1 } : x));
  }

  async function setDeadline(t: Todo, deadline: string) {
    const res = await fetch(`/api/todos/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline }) });
    if (!res.ok) return;
    setTodos(currentTodos => currentTodos.map(x => x.id === t.id ? { ...x, deadline: deadline || undefined } : x));
  }

  async function deleteTodo(id: number) {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setTodos(currentTodos => currentTodos.filter(t => t.id !== id));
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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('markdownEditor')}</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{t('adminTodos')}</h1>
        </div>
        {editingId !== null && (
          <button type="button" onClick={resetEditor} className="self-start rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 sm:self-auto">
            {t('cancelEdit')}
          </button>
        )}
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{editingId === null ? t('newTodo') : t('editTodo')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('todoMarkdownHelp')}</p>
          </div>
          <div className="flex gap-2">
            <input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm text-gray-500" />
            <button onClick={saveTodo} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40" disabled={!text.trim()}>
              {editingId === null ? t('add') : t('saveChanges')}
            </button>
          </div>
        </div>

        <MarkdownEditor
          value={text}
          onChange={setText}
          rows={16}
          minHeight={240}
          textareaTestId="todo-markdown-editor"
          previewTestId="todo-markdown-preview"
        />
      </section>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search..."
          className="border rounded-lg px-3 py-2 flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-black/10" />
        <select value={filter} onChange={e => { setFilter(e.target.value as any); setPage(1); }}
          className="border rounded-lg px-2 py-2 text-sm">
          <option value="all">{t('all')}</option>
          <option value="pending">{t('pending')}</option>
          <option value="done">{t('done')}</option>
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
                <article className={`prose prose-sm min-w-0 flex-1 max-w-none leading-snug ${todo.done ? 'text-gray-400 line-through prose-p:text-gray-400' : 'text-slate-700'}`}>
                  <ReactMarkdown>{todo.text}</ReactMarkdown>
                </article>
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
                <button onClick={() => editTodo(todo)} className="text-slate-600 text-xs shrink-0 hover:text-black">{t('edit')}</button>
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
