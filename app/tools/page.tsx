'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import FortuneTool from '@/components/FortuneTool';
import AIChatTool from '@/components/AIChatTool';
import SubscriptionBriefsTool from '@/components/SubscriptionBriefsTool';
import { useLocale } from '@/components/useLocale';

interface Todo { id: number; text: string; done: number; }
interface DiaryEntry { id: number; date: string; content: string; }
const PAGE_SIZE = 10;

export default function ToolsPage() {
  const [tab, setTab] = useState<'todos' | 'diary' | 'bazi' | 'ai-chat' | 'subscriptions'>('todos');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [todoSearch, setTodoSearch] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [todoFilter, setTodoFilter] = useState<'all' | 'done' | 'pending'>('all');
  const [todoPage, setTodoPage] = useState(1);
  const [diaryPage, setDiaryPage] = useState(1);
  const { t } = useLocale();

  useEffect(() => {
    fetch('/api/todos').then(r => r.ok ? r.json() : Promise.reject()).then(setTodos).catch(() => {});
    fetch('/api/diary').then(r => r.ok ? r.json() : Promise.reject()).then(setEntries).catch(() => {});
  }, []);

  const filteredTodos = todos
    .filter(todo => todo.text.toLowerCase().includes(todoSearch.toLowerCase()))
    .filter(todo => todoFilter === 'all' ? true : todoFilter === 'done' ? todo.done : !todo.done);
  const pagedTodos = filteredTodos.slice((todoPage - 1) * PAGE_SIZE, todoPage * PAGE_SIZE);

  const filteredDiary = entries.filter(e =>
    e.date.includes(diarySearch) || e.content.toLowerCase().includes(diarySearch.toLowerCase())
  );
  const pagedDiary = filteredDiary.slice((diaryPage - 1) * PAGE_SIZE, diaryPage * PAGE_SIZE);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-3xl font-bold mb-6">{t('tools')}</h1>
      <div className="flex gap-1 mb-8 border-b overflow-x-auto">
        {([
          ['todos', t('toolsTitle')],
          ['diary', t('diary')],
          ['bazi', t('bazi')],
          ['ai-chat', t('aiChat')],
          ['subscriptions', t('subscriptions')],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`pb-2 px-1 mr-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === id ? 'border-b-2 border-black' : 'text-gray-500 hover:text-black'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'todos' && (
        <>
          <div className="flex gap-2 mb-4">
            <input value={todoSearch} onChange={e => { setTodoSearch(e.target.value); setTodoPage(1); }}
              placeholder={t('searchPlaceholder')} className="border rounded px-3 py-1 text-sm flex-1" />
            <select value={todoFilter} onChange={e => { setTodoFilter(e.target.value as any); setTodoPage(1); }}
              className="border rounded px-2 py-1 text-sm">
              <option value="all">{t('all')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="done">{t('done')}</option>
            </select>
          </div>
          {pagedTodos.length === 0 && <p className="text-gray-500">{t('noTodos')}</p>}
          <ul className="space-y-2">
            {pagedTodos.map(todo => (
              <li key={todo.id} className={`flex items-center gap-2 ${todo.done ? 'line-through text-gray-400' : ''}`}>
                <span>{todo.text}</span>
              </li>
            ))}
          </ul>
          <Pagination total={filteredTodos.length} page={todoPage} pageSize={PAGE_SIZE} onPage={setTodoPage} />
        </>
      )}

      {tab === 'diary' && (
        <>
          <input value={diarySearch} onChange={e => { setDiarySearch(e.target.value); setDiaryPage(1); }}
            placeholder={t('searchPlaceholder')} className="w-full border rounded px-3 py-2 mb-4 text-sm" />
          {pagedDiary.length === 0 && <p className="text-gray-500">{t('noPosts')}</p>}
          <ul className="space-y-4">
            {pagedDiary.map(e => (
              <li key={e.id} className="border rounded px-4 py-3">
                <p className="font-semibold mb-2">{e.date}</p>
                <article className="prose prose-sm max-w-none">
                  <ReactMarkdown>{e.content}</ReactMarkdown>
                </article>
              </li>
            ))}
          </ul>
          <Pagination total={filteredDiary.length} page={diaryPage} pageSize={PAGE_SIZE} onPage={setDiaryPage} />
        </>
      )}

      {tab === 'bazi' && <FortuneTool />}

      {tab === 'ai-chat' && <AIChatTool />}

      {tab === 'subscriptions' && <SubscriptionBriefsTool />}
    </main>
  );
}
