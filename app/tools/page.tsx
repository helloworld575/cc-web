'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import FortuneTool from '@/components/FortuneTool';
import AIChatTool from '@/components/AIChatTool';
import SubscriptionBriefsTool from '@/components/SubscriptionBriefsTool';
import { useLocale } from '@/components/useLocale';
import { formatSkillPath, groupSkillSummaries, matchSkillSummary, type SkillSummary } from '@/lib/skill-taxonomy';

interface Todo {
  id: number;
  text: string;
  done: number;
}

interface DiaryEntry {
  id: number;
  date: string;
  content: string;
}

type ToolTab = 'todos' | 'diary' | 'bazi' | 'ai-chat' | 'subscriptions' | 'skills';

const PAGE_SIZE = 10;

const TAB_META = {
  todos: {
    eyebrow: 'Workflow',
    description: 'Search, filter, and skim your task queue without losing the quiet rhythm of the page.',
  },
  diary: {
    eyebrow: 'Archive',
    description: 'Read back through entries in a cleaner reading surface with better spacing and calmer typography.',
  },
  bazi: {
    eyebrow: 'Fortune',
    description: 'Run divination workflows with visible generation states instead of a hard cut from empty to final text.',
  },
  'ai-chat': {
    eyebrow: 'Conversation',
    description: 'A dedicated streaming chat studio that renders markdown live while the response is still arriving.',
  },
  subscriptions: {
    eyebrow: 'Digest',
    description: 'Catch up on briefs in one place with the same visual language as the rest of the workspace.',
  },
  skills: {
    eyebrow: 'Catalog',
    description: 'Browse the full Codex skill inventory by hierarchy so you can discover the right workflow without loading every instruction into context.',
  },
} as const;

export default function ToolsPage() {
  const [tab, setTab] = useState<ToolTab>('todos');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [todoSearch, setTodoSearch] = useState('');
  const [diarySearch, setDiarySearch] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [todoFilter, setTodoFilter] = useState<'all' | 'done' | 'pending'>('all');
  const [todoPage, setTodoPage] = useState(1);
  const [diaryPage, setDiaryPage] = useState(1);
  const deferredSkillQuery = useDeferredValue(skillQuery);
  const { t } = useLocale();

  useEffect(() => {
    fetch('/api/todos').then(res => (res.ok ? res.json() : Promise.reject())).then(setTodos).catch(() => {});
    fetch('/api/diary').then(res => (res.ok ? res.json() : Promise.reject())).then(setEntries).catch(() => {});
    fetch('/api/skills?catalog=all').then(res => (res.ok ? res.json() : Promise.reject())).then(setSkills).catch(() => {});
  }, []);

  const filteredTodos = todos
    .filter(todo => todo.text.toLowerCase().includes(todoSearch.toLowerCase()))
    .filter(todo => (todoFilter === 'all' ? true : todoFilter === 'done' ? todo.done : !todo.done));
  const pagedTodos = filteredTodos.slice((todoPage - 1) * PAGE_SIZE, todoPage * PAGE_SIZE);

  const filteredDiary = entries.filter(entry =>
    entry.date.includes(diarySearch) || entry.content.toLowerCase().includes(diarySearch.toLowerCase())
  );
  const pagedDiary = filteredDiary.slice((diaryPage - 1) * PAGE_SIZE, diaryPage * PAGE_SIZE);
  const filteredSkills = skills.filter(skill => matchSkillSummary(skill, deferredSkillQuery));
  const groupedSkills = groupSkillSummaries(filteredSkills);
  const invocableSkillCount = skills.filter(skill => skill.invocable).length;

  return (
    <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),radial-gradient(circle_at_center,rgba(15,23,42,0.08),transparent_62%)] blur-3xl" />

      <section className="glass-panel mb-8 rounded-[34px] px-6 py-7 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Workspace</p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">{t('tools')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              A calmer command deck for daily work, diary review, divination flows, and AI collaboration.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Live', 'Streaming markdown'],
              ['Elegant', 'More motion, less abruptness'],
              ['Scoped', 'Skills grouped by hierarchy'],
            ].map(([title, subtitle], index) => (
              <div
                key={title}
                className="rounded-[22px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm animate-slide-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
                <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-3 md:grid-cols-6">
        {([
          ['todos', t('toolsTitle')],
          ['diary', t('diary')],
          ['bazi', t('bazi')],
          ['ai-chat', t('aiChat')],
          ['subscriptions', t('subscriptions')],
          ['skills', 'Skills'],
        ] as const).map(([id, label], index) => {
          const active = tab === id;
          const meta = TAB_META[id];

          return (
            <button
              key={id}
              data-testid={`tools-tab-${id}`}
              onClick={() => setTab(id)}
              className={`rounded-[26px] border px-4 py-4 text-left transition duration-300 animate-slide-up ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white shadow-xl'
                  : 'border-white/70 bg-white/82 text-slate-700 shadow-sm hover:-translate-y-1 hover:border-slate-200 hover:shadow-lg'
              }`}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${active ? 'text-white/55' : 'text-slate-400'}`}>
                {meta.eyebrow}
              </p>
              <p className="mt-2 text-base font-semibold">{label}</p>
              <p className={`mt-2 text-sm leading-6 ${active ? 'text-white/72' : 'text-slate-500'}`}>
                {meta.description}
              </p>
            </button>
          );
        })}
      </div>

      <section className="glass-panel rounded-[34px] px-4 py-4 sm:px-6 sm:py-6">
        {tab === 'todos' && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Filter</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">{t('toolsTitle')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Narrow down your queue and scan the essentials without a cluttered table layout.
              </p>

              <div className="mt-5 space-y-4">
                <input
                  value={todoSearch}
                  onChange={event => {
                    setTodoSearch(event.target.value);
                    setTodoPage(1);
                  }}
                  placeholder={t('searchPlaceholder')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                <select
                  value={todoFilter}
                  onChange={event => {
                    setTodoFilter(event.target.value as 'all' | 'done' | 'pending');
                    setTodoPage(1);
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="all">{t('all')}</option>
                  <option value="pending">{t('pending')}</option>
                  <option value="done">{t('done')}</option>
                </select>
                <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">Visible</p>
                  <p className="mt-2 text-4xl font-semibold">{filteredTodos.length}</p>
                  <p className="mt-2 text-sm text-white/70">tasks after search and status filters.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              {pagedTodos.length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center text-center text-slate-500">
                  <div>
                    <p className="font-display text-3xl text-slate-900">{t('noTodos')}</p>
                    <p className="mt-3 text-sm text-slate-500">Try changing the filters or add a new task from the admin panel.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {pagedTodos.map((todo, index) => (
                    <li
                      key={todo.id}
                      className={`rounded-[24px] border px-4 py-4 transition animate-slide-up ${
                        todo.done
                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : 'border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(241,245,249,0.86))] text-slate-700 shadow-sm'
                      }`}
                      style={{ animationDelay: `${index * 45}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${todo.done ? 'bg-slate-300' : 'bg-emerald-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-7 ${todo.done ? 'line-through' : ''}`}>{todo.text}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Pagination total={filteredTodos.length} page={todoPage} pageSize={PAGE_SIZE} onPage={setTodoPage} />
            </div>
          </div>
        )}

        {tab === 'diary' && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Search</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">{t('diary')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                A softer reading mode for notes, sketches, and older entries that should breathe a little more.
              </p>

              <div className="mt-5 space-y-4">
                <input
                  value={diarySearch}
                  onChange={event => {
                    setDiarySearch(event.target.value);
                    setDiaryPage(1);
                  }}
                  placeholder={t('searchPlaceholder')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                <div className="rounded-[24px] bg-[#f8f5ef] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-700/50">Pages</p>
                  <p className="mt-2 font-display text-4xl text-slate-900">{filteredDiary.length}</p>
                  <p className="mt-2 text-sm text-slate-500">entries match the current date or content search.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              {pagedDiary.length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center text-center text-slate-500">
                  <div>
                    <p className="font-display text-3xl text-slate-900">{t('noPosts')}</p>
                    <p className="mt-3 text-sm text-slate-500">Try a broader keyword or scroll another page of entries.</p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-4">
                  {pagedDiary.map((entry, index) => (
                    <li
                      key={entry.id}
                      className="rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.9))] px-5 py-5 shadow-sm animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{entry.date}</p>
                      <article className="mt-4 prose prose-sm max-w-none prose-headings:font-semibold prose-p:leading-7 prose-p:text-slate-600">
                        <ReactMarkdown>{entry.content}</ReactMarkdown>
                      </article>
                    </li>
                  ))}
                </ul>
              )}

              <Pagination total={filteredDiary.length} page={diaryPage} pageSize={PAGE_SIZE} onPage={setDiaryPage} />
            </div>
          </div>
        )}

        {tab === 'bazi' && <FortuneTool />}

        {tab === 'ai-chat' && <AIChatTool />}

        {tab === 'subscriptions' && <SubscriptionBriefsTool />}

        {tab === 'skills' && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Catalog</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">Codex skills</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                Search by name, invoke path, alias, or keyword. App-invocable skills stay available to the web app, while guide skills remain lightweight references for Codex to load only when needed.
              </p>

              <input
                data-testid="tools-skills-search"
                value={skillQuery}
                onChange={event => setSkillQuery(event.target.value)}
                placeholder="Find by name, path, or keyword"
                className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />

              <div className="mt-5 grid gap-3">
                <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">Catalog</p>
                  <p className="mt-2 text-4xl font-semibold">{skills.length}</p>
                  <p className="mt-2 text-sm text-white/70">skills indexed from `.codex/skills`.</p>
                </div>
                <div className="rounded-[24px] bg-[#f8f5ef] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-700/50">Invocable</p>
                  <p className="mt-2 font-display text-4xl text-slate-900">{invocableSkillCount}</p>
                  <p className="mt-2 text-sm text-slate-500">skills with prompt contracts that the web app can execute directly.</p>
                </div>
              </div>
            </aside>

            <section data-testid="tools-skills-panel" className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              <div className="space-y-4">
                {groupedSkills.map(group => (
                  <section key={group.key} className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] px-4 py-4">
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{group.label}</p>
                        <p className="mt-2 text-sm text-slate-500">{group.skills.length} skills in this lane.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {group.skills.map((skill, index) => (
                        <article
                          key={skill.id}
                          className="rounded-[22px] border border-white/80 bg-white px-4 py-4 shadow-sm transition animate-slide-up"
                          style={{ animationDelay: `${index * 35}ms` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                              <p className="mt-1 text-xs leading-6 text-slate-500">{skill.description}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                skill.invocable
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {skill.invocable ? skill.output ?? 'text' : 'guide'}
                            </span>
                          </div>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {formatSkillPath(skill)}
                          </p>
                          <div className="mt-3 rounded-[18px] bg-slate-50 px-3 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Invoke path</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-600">{skill.lookup.invoke}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}

                {groupedSkills.length === 0 && (
                  <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                    No skills matched the current search.
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
