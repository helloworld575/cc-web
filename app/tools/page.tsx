'use client';
import { useDeferredValue, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Pagination from '@/components/Pagination';
import FortuneTool from '@/components/FortuneTool';
import AIChatTool from '@/components/AIChatTool';
import AIImageTool from '@/components/AIImageTool';
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

type ToolTab = 'todos' | 'diary' | 'bazi' | 'ai-chat' | 'image' | 'subscriptions' | 'skills';

const PAGE_SIZE = 10;

const TOOLS_COPY = {
  en: {
    workspace: 'Workspace',
    workspaceDesc: 'A calmer command deck for daily work, diary review, divination flows, and AI collaboration.',
    cards: [
      ['Live', 'Streaming markdown'],
      ['Elegant', 'More motion, less abruptness'],
      ['Scoped', 'Skills grouped by hierarchy'],
    ],
    tabLabels: {
      skills: 'Skills',
    },
    tabMeta: {
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
      image: {
        eyebrow: 'Creative',
        description: 'Generate quick images through the configured gpt-image-2 endpoint.',
      },
      subscriptions: {
        eyebrow: 'Digest',
        description: 'Catch up on briefs in one place with the same visual language as the rest of the workspace.',
      },
      skills: {
        eyebrow: 'Catalog',
        description: 'Browse the full Codex skill inventory by hierarchy so you can discover the right workflow without loading every instruction into context.',
      },
    },
    todos: {
      filter: 'Filter',
      intro: 'Narrow down your queue and scan the essentials without a cluttered table layout.',
      visible: 'Visible',
      visibleDesc: 'tasks after search and status filters.',
      empty: 'Try changing the filters or add a new task from the admin panel.',
    },
    diary: {
      search: 'Search',
      intro: 'A softer reading mode for notes, sketches, and older entries that should breathe a little more.',
      pages: 'Pages',
      pagesDesc: 'entries match the current date or content search.',
      empty: 'Try a broader keyword or scroll another page of entries.',
    },
    skills: {
      catalog: 'Catalog',
      heading: 'Codex skills',
      intro: 'Search by name, invoke path, alias, or keyword. App-invocable skills stay available to the web app, while guide skills remain lightweight references for Codex to load only when needed.',
      placeholder: 'Find by name, path, or keyword',
      catalogDesc: 'skills indexed from `.codex/skills`.',
      invocable: 'Invocable',
      invocableDesc: 'skills with prompt contracts that the web app can execute directly.',
      routers: 'Routers',
      routersDesc: 'root or router skills that narrow the tree before loading a leaf skill.',
      routingTree: 'Routing Tree',
      routingTreeDesc: 'Main skills route to more specific child skills so the agent can load less context.',
      laneSuffix: 'skills in this lane.',
      noMatches: 'No skills matched the current search.',
      invokePath: 'Invoke path',
      routesTo: 'Routes To',
      routes: 'routes',
    },
  },
  zh: {
    workspace: '工作台',
    workspaceDesc: '更安静的工作台，用来处理日常任务、日记回顾、命理流程与 AI 协作。',
    cards: [
      ['流式', 'Markdown 实时呈现'],
      ['顺滑', '更克制的动效与切换'],
      ['分层', '按层级整理 skills'],
    ],
    tabLabels: {
      skills: '技能',
    },
    tabMeta: {
      todos: {
        eyebrow: '流程',
        description: '搜索、筛选并快速浏览待办，不打断页面的整体节奏。',
      },
      diary: {
        eyebrow: '归档',
        description: '用更干净的阅读面板回看日记，留出更舒服的留白与层次。',
      },
      bazi: {
        eyebrow: '命理',
        description: '命理分析过程以可见状态逐步展开，而不是从空白直接跳到结果。',
      },
      'ai-chat': {
        eyebrow: '对话',
        description: '独立的流式聊天工作区，支持 Markdown 实时渲染。',
      },
      subscriptions: {
        eyebrow: '订阅',
        description: '在统一的视觉语言下集中查看订阅摘要与更新。',
      },
      skills: {
        eyebrow: '目录',
        description: '按层级浏览完整的 Codex skill 目录，在真正需要时再加载对应上下文。',
      },
    },
    todos: {
      filter: '筛选',
      intro: '先缩小范围，再浏览关键任务，不再被传统列表布局打断。',
      visible: '结果',
      visibleDesc: '条任务符合当前搜索与状态筛选。',
      empty: '试试调整筛选条件，或者先去管理后台新增任务。',
    },
    diary: {
      search: '搜索',
      intro: '给日记和笔记一个更柔和的阅读模式，让内容本身更舒展。',
      pages: '条目',
      pagesDesc: '篇内容匹配当前日期或关键词搜索。',
      empty: '试试更宽泛的关键词，或者翻到其他页查看。',
    },
    skills: {
      catalog: '目录',
      heading: 'Codex 技能',
      intro: '可按名称、调用路径、别名或关键词检索。可执行 skill 继续服务于 Web 应用，而 guide skill 则保持轻量，只在需要时加载。',
      placeholder: '按名称、路径或关键词查找',
      catalogDesc: '个 skill 已从 `.codex/skills` 建立索引。',
      invocable: '可执行',
      invocableDesc: '个 skill 带有 prompt contract，可直接被 Web 应用调用。',
      routers: '路由层',
      routersDesc: '个 root 或 router skill 用来先缩小分支，再进入具体 leaf skill。',
      routingTree: '路由树',
      routingTreeDesc: '主 skill 会继续路由到更具体的子 skill，从而减少上下文占用。',
      laneSuffix: '个 skill 位于这一分组。',
      noMatches: '当前搜索没有匹配到任何 skill。',
      invokePath: '调用路径',
      routesTo: '路由到',
      routes: '条路由',
    },
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
  const { locale, t } = useLocale();
  const copy = TOOLS_COPY[locale];

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
  const rootSkillCount = skills.filter(skill => skill.orchestration.role === 'root').length;
  const routerSkillCount = skills.filter(skill => skill.orchestration.role === 'router').length;
  const routedSkills = filteredSkills.filter(skill => skill.orchestration.children.length > 0);
  const tabMeta = copy.tabMeta as Partial<Record<ToolTab, { eyebrow: string; description: string }>>;

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_40%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.16),transparent_34%),radial-gradient(circle_at_center,rgba(15,23,42,0.08),transparent_62%)] blur-3xl" />

      <section className="glass-panel mb-8 rounded-[34px] px-6 py-7 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{copy.workspace}</p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">{t('tools')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {copy.workspaceDesc}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {copy.cards.map(([title, subtitle], index) => (
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

      <div className="relative z-10 mb-6 grid gap-3 md:grid-cols-7">
        {([
          ['todos', t('toolsTitle')],
          ['diary', t('diary')],
          ['bazi', t('bazi')],
          ['ai-chat', t('aiChat')],
          ['image', 'Image'],
          ['subscriptions', t('subscriptions')],
          ['skills', copy.tabLabels.skills],
        ] as const).map(([id, label], index) => {
          const active = tab === id;
          const meta = tabMeta[id] ?? TOOLS_COPY.en.tabMeta[id];

          return (
            <button
              type="button"
              key={id}
              data-testid={`tools-tab-${id}`}
              onClick={() => setTab(id)}
              className={`relative z-10 rounded-[26px] border px-4 py-4 text-left transition duration-300 animate-slide-up ${
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

      <section className="relative z-10 glass-panel rounded-[34px] px-4 py-4 sm:px-6 sm:py-6">
        {tab === 'todos' && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.todos.filter}</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">{t('toolsTitle')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {copy.todos.intro}
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
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">{copy.todos.visible}</p>
                  <p className="mt-2 text-4xl font-semibold">{filteredTodos.length}</p>
                  <p className="mt-2 text-sm text-white/70">{copy.todos.visibleDesc}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              {pagedTodos.length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center text-center text-slate-500">
                  <div>
                    <p className="font-display text-3xl text-slate-900">{t('noTodos')}</p>
                    <p className="mt-3 text-sm text-slate-500">{copy.todos.empty}</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.diary.search}</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">{t('diary')}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {copy.diary.intro}
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
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-700/50">{copy.diary.pages}</p>
                  <p className="mt-2 font-display text-4xl text-slate-900">{filteredDiary.length}</p>
                  <p className="mt-2 text-sm text-slate-500">{copy.diary.pagesDesc}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              {pagedDiary.length === 0 ? (
                <div className="flex min-h-[360px] items-center justify-center text-center text-slate-500">
                  <div>
                    <p className="font-display text-3xl text-slate-900">{t('noPosts')}</p>
                    <p className="mt-3 text-sm text-slate-500">{copy.diary.empty}</p>
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

        {tab === 'image' && <AIImageTool />}

        {tab === 'subscriptions' && <SubscriptionBriefsTool />}

        {tab === 'skills' && (
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.skills.catalog}</p>
              <h2 className="mt-2 font-display text-3xl text-slate-900">{copy.skills.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {copy.skills.intro}
              </p>

              <input
                data-testid="tools-skills-search"
                value={skillQuery}
                onChange={event => setSkillQuery(event.target.value)}
                placeholder={copy.skills.placeholder}
                className="mt-5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              />

              <div className="mt-5 grid gap-3">
                <div className="rounded-[24px] bg-slate-950 px-4 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">{copy.skills.catalog}</p>
                  <p className="mt-2 text-4xl font-semibold">{skills.length}</p>
                  <p className="mt-2 text-sm text-white/70">{copy.skills.catalogDesc}</p>
                </div>
                <div className="rounded-[24px] bg-[#f8f5ef] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-700/50">{copy.skills.invocable}</p>
                  <p className="mt-2 font-display text-4xl text-slate-900">{invocableSkillCount}</p>
                  <p className="mt-2 text-sm text-slate-500">{copy.skills.invocableDesc}</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{copy.skills.routers}</p>
                  <p className="mt-2 font-display text-4xl text-slate-900">{rootSkillCount + routerSkillCount}</p>
                  <p className="mt-2 text-sm text-slate-500">{copy.skills.routersDesc}</p>
                </div>
              </div>
            </aside>

            <section data-testid="tools-skills-panel" className="rounded-[28px] border border-white/70 bg-white/94 p-5 shadow-sm">
              <div data-testid="tools-skills-compact-list" className="max-h-[calc(100vh-220px)] min-h-[320px] space-y-4 overflow-y-auto pr-2">
                {routedSkills.length > 0 && (
                  <section className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.88))] px-4 py-4">
                    <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{copy.skills.routingTree}</p>
                        <p className="mt-2 text-sm text-slate-500">{copy.skills.routingTreeDesc}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {routedSkills.map(skill => (
                        <article key={`route-${skill.id}`} className="rounded-[22px] border border-white/80 bg-white px-4 py-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                              <p className="mt-1 text-xs leading-6 text-slate-500">{skill.description}</p>
                            </div>
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                              {skill.orchestration.role}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                              {skill.orchestration.mode}
                            </span>
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                              {skill.orchestration.children.length} {copy.skills.routes}
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            {skill.orchestration.children.slice(0, 4).map(child => (
                              <div key={`${skill.id}-${child.skill}`} className="rounded-[18px] bg-slate-50 px-3 py-3">
                                <p className="font-mono text-xs text-slate-700">{child.skill}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{child.when}</p>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                {groupedSkills.map(group => (
                  <details key={group.key} className="rounded-[20px] border border-slate-100 bg-white/95 px-4 py-3 shadow-sm" open={deferredSkillQuery.length > 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{group.label}</span>
                        <span className="mt-1 block text-sm text-slate-500">{group.skills.length} {copy.skills.laneSuffix}</span>
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Open</span>
                    </summary>

                    <div className="mt-3 grid gap-2">
                      {group.skills.map((skill, index) => (
                        <article
                          key={skill.id}
                          className="rounded-[16px] border border-slate-100 bg-slate-50/80 px-3 py-3 transition animate-slide-up"
                          style={{ animationDelay: `${index * 35}ms` }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{skill.description}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap justify-end gap-2">
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                                {skill.orchestration.role}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                                  skill.invocable
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {skill.invocable ? skill.output ?? 'text' : skill.orchestration.mode}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {formatSkillPath(skill)}
                          </p>
                          <div className="mt-2 rounded-[14px] bg-white px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.skills.invokePath}</p>
                            <p className="mt-1 break-all font-mono text-xs text-slate-600">{skill.lookup.invoke}</p>
                          </div>
                          {skill.orchestration.children.length > 0 && (
                            <div className="mt-2 rounded-[14px] bg-white px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{copy.skills.routesTo}</p>
                              <p className="mt-1 text-xs leading-6 text-slate-600">
                                {skill.orchestration.children.map(child => child.skill).join(', ')}
                              </p>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </details>
                ))}

                {groupedSkills.length === 0 && (
                  <div className="flex min-h-[320px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
                    {copy.skills.noMatches}
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
