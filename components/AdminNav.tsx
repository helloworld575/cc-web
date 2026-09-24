'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/components/useLocale';

const groups = [
  { label: 'Work', links: [['/admin', 'adminNavWorkbench'], ['/admin/tools', 'adminNavTodos']] },
  { label: 'Agents', links: [['/tools?tab=ai-chat', 'adminNavAiChat'], ['/admin/claude-code', 'adminNavAssistant'], ['/admin/skills', 'adminNavSkills'], ['/admin/ai-config', 'adminNavAiProviders']] },
  { label: 'Content', links: [['/admin/blog', 'adminNavBlog'], ['/admin/blog-analytics', 'adminNavAnalytics'], ['/admin/diary', 'adminNavDiary'], ['/admin/files', 'adminNavFiles'], ['/admin/x-post', 'adminNavPostX']] },
  { label: 'Sources', links: [['/admin/subscriptions', 'adminNavSubscriptions']] },
] as const;

export default function AdminNav() {
  const { t } = useLocale();
  const pathname = usePathname();

  return (
    <nav className="flex gap-5 overflow-x-auto border-b bg-gray-50 px-6 py-3 text-sm">
      {groups.map(group => <div key={group.label} className="flex shrink-0 items-center gap-2"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.label}</span>{group.links.map(([href, key]) => { const active = pathname === href.split('?')[0] || (href === '/admin' && pathname === '/admin'); return <Link key={href} href={href} className={`whitespace-nowrap rounded-md px-2 py-1 transition ${active ? 'bg-slate-900 font-medium text-white' : 'text-slate-600 hover:bg-white hover:text-slate-950'}`}>{t(key as Parameters<typeof t>[0])}</Link>; })}</div>)}
    </nav>
  );
}
