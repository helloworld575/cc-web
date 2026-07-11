'use client';

import Link from 'next/link';
import { useLocale } from '@/components/useLocale';

const links = [
  ['/admin/blog', 'adminNavBlog'],
  ['/admin/blog-analytics', 'adminNavAnalytics'],
  ['/admin/tools', 'adminNavTodos'],
  ['/admin/diary', 'adminNavDiary'],
  ['/admin/files', 'adminNavFiles'],
  ['/admin/skills', 'adminNavSkills'],
  ['/admin/ai-config', 'adminNavAiProviders'],
  ['/admin/claude-code', 'adminNavAssistant'],
  ['/admin/subscriptions', 'adminNavSubscriptions'],
  ['/admin/x-post', 'adminNavPostX'],
] as const;

export default function AdminNav() {
  const { t } = useLocale();

  return (
    <nav className="flex gap-4 overflow-x-auto border-b bg-gray-50 px-6 py-2 text-sm">
      {links.map(([href, key]) => (
        <Link key={href} href={href} className="whitespace-nowrap">
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
