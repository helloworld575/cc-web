'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/useLocale';

interface WorkbenchSummary {
  taskCounts: { open: number; overdue: number; dueToday: number };
  dueTasks: Array<{ id: number; text: string; deadline?: string | null }>;
  recentAgents: {
    aiChat: Array<{ id: number; title: string; skill_id?: string | null; provider_name?: string; status: string; updated_at: string }>;
    claudeCode: Array<{ id: number; title: string; status: string; updated_at: string }>;
  };
  integrations: { securityConfigured: boolean };
}

const copy = {
  en: {
    eyebrow: 'Personal workbench', title: 'My workbench', desc: 'One place to decide what matters today, continue an agent session, and keep the next action visible.',
    refresh: 'Refresh', open: 'Open', today: 'Due today', overdue: 'Overdue', tasks: 'Open tasks', todayTitle: 'Today', todayDesc: 'Deadlines and unfinished work that need a decision.', empty: 'No due tasks. Add the next concrete action.', tasksLink: 'Manage tasks', agents: 'Agents', agentsDesc: 'Continue a saved conversation or start a focused coding session.', chat: 'AI chat', claude: 'Claude Code', newChat: 'Start chat', continue: 'Continue', noSessions: 'No saved sessions yet.', quick: 'Quick actions', skills: 'Skills', diary: 'Diary', blog: 'Blog', subscriptions: 'Subscriptions', security: 'Security service', connected: 'Configured', notConfigured: 'Not configured', assessments: 'Recent assessments', view: 'View',
  },
  zh: {
    eyebrow: '个人工作台', title: '我的工作台', desc: '在一个入口决定今天最重要的事，继续已有 Agent 会话，并让下一步始终可见。',
    refresh: '刷新', open: '未完成', today: '今天到期', overdue: '已逾期', tasks: '待处理任务', todayTitle: '今天', todayDesc: '需要现在做决定的截止事项和未完成工作。', empty: '暂无到期任务，先添加一个具体的下一步。', tasksLink: '管理任务', agents: 'Agent', agentsDesc: '继续保存的对话，或启动一次专注的代码工作。', chat: 'AI 对话', claude: 'Claude Code', newChat: '开始对话', continue: '继续', noSessions: '还没有保存的会话。', quick: '快速入口', skills: '技能', diary: '日记', blog: '博客', subscriptions: '订阅', security: '安全服务', connected: '已配置', notConfigured: '未配置', assessments: '近期评估', view: '查看',
  },
} as const;

export default function WorkbenchPage() {
  const { locale } = useLocale();
  const text = copy[locale];
  const [summary, setSummary] = useState<WorkbenchSummary | null>(null);
  const [assessmentCount, setAssessmentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/workbench/summary');
      if (response.ok) setSummary(await response.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!summary?.integrations.securityConfigured) return;
    fetch('/api/security/v1/assessments?limit=5')
      .then(response => response.ok ? response.json() : null)
      .then(payload => setAssessmentCount(Array.isArray(payload?.data?.items) ? payload.data.items.length : null))
      .catch(() => setAssessmentCount(null));
  }, [summary?.integrations.securityConfigured]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{text.eyebrow}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">{text.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{text.desc}</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {text.refresh}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={text.tasks}>
        {[[text.open, summary?.taskCounts.open ?? 0], [text.today, summary?.taskCounts.dueToday ?? 0], [text.overdue, summary?.taskCounts.overdue ?? 0]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold text-slate-950">{text.todayTitle}</h2><p className="mt-1 text-sm text-slate-500">{text.todayDesc}</p></div>
            <Link href="/admin/tools" className="text-sm font-medium text-sky-700 hover:underline">{text.tasksLink}</Link>
          </div>
          <div className="mt-5 space-y-2">
            {summary?.dueTasks.length ? summary.dueTasks.map(task => (
              <Link key={task.id} href="/admin/tools" className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-sky-200 hover:bg-sky-50">
                <span className="line-clamp-2 text-sm text-slate-700">{task.text}</span>
                <span className="shrink-0 text-xs font-medium text-slate-500">{task.deadline}</span>
              </Link>
            )) : <p className="rounded-xl bg-slate-50 px-4 py-4 text-sm text-slate-500">{text.empty}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-950">{text.agents}</h2><p className="mt-1 text-sm text-slate-500">{text.agentsDesc}</p></div><Link href="/tools?tab=ai-chat" className="text-sm font-medium text-sky-700 hover:underline">{text.newChat}</Link></div>
          <div className="mt-5 space-y-4">
            <AgentGroup title={text.chat} href="/tools?tab=ai-chat" sessions={summary?.recentAgents.aiChat ?? []} text={text} getHref={session => `/tools?tab=ai-chat&chat=${session.id}`} />
            <AgentGroup title={text.claude} href="/admin/claude-code" sessions={summary?.recentAgents.claudeCode ?? []} text={text} getHref={session => `/admin/claude-code?chat=${session.id}`} />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-slate-950">{text.quick}</h2><div className="flex items-center gap-3 text-xs font-medium"><span className={summary?.integrations.securityConfigured ? 'text-emerald-700' : 'text-slate-400'}>{text.security}: {summary?.integrations.securityConfigured ? text.connected : text.notConfigured}</span>{assessmentCount !== null && <span className="text-sky-700">{text.assessments}: {assessmentCount}</span>}</div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[[text.skills, '/admin/skills'], [text.diary, '/admin/diary'], [text.blog, '/admin/blog'], [text.subscriptions, '/admin/subscriptions']].map(([label, href]) => <Link key={href} href={href} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-sky-200 hover:bg-sky-50">{label}</Link>)}
        </div>
      </section>
    </main>
  );
}

function AgentGroup({ title, href, sessions, text, getHref }: { title: string; href: string; sessions: Array<{ id: number; title: string; skill_id?: string | null; status: string; updated_at: string }>; text: { noSessions: string; view: string }; getHref?: (session: { id: number }) => string }) {
  return <div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">{title}</h3><Link href={href} className="text-xs text-sky-700 hover:underline">{text.view}</Link></div>{sessions.length ? <div className="mt-2 space-y-2">{sessions.slice(0, 3).map(session => <Link key={session.id} href={getHref?.(session) ?? href} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-sky-50"><span className="min-w-0 truncate text-slate-700">{session.title}</span><span className="shrink-0 text-xs text-slate-400">{session.status}</span></Link>)}</div> : <p className="mt-2 text-xs text-slate-400">{text.noSessions}</p>}</div>;
}
