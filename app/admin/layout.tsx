import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return (
    <>
      <nav className="bg-gray-50 border-b px-6 py-2 flex gap-4 text-sm">
        <Link href="/admin/blog">Blog</Link>
        <Link href="/admin/tools">Todos</Link>
        <Link href="/admin/diary">Diary</Link>
        <Link href="/admin/files">Files</Link>
        <Link href="/admin/skills">Skills</Link>
        <Link href="/admin/ai-config">AI Config</Link>
        <Link href="/admin/subscriptions">Subscriptions</Link>
      </nav>
      {children}
    </>
  );
}
