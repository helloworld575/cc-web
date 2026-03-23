'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useLocale } from '@/components/useLocale';

export default function Nav() {
  const { data: session } = useSession();
  const { locale, toggle, t } = useLocale();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <nav className="border-b px-4 py-3">
      <div className="flex items-center gap-5 text-sm">
        <Link href="/" className="font-bold flex items-center gap-1.5" onClick={close}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#111"/>
            <text x="16" y="22" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold" fontFamily="system-ui">T</text>
          </svg>
          ThomasLee
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex gap-5 items-center">
          <Link href="/blog">{t('blog')}</Link>
          <Link href="/tools">{t('tools')}</Link>
          <Link href="/files">{t('files')}</Link>
        </div>

        <div className="ml-auto flex gap-3 items-center">
          <div className="hidden sm:flex gap-4 items-center">
            {session ? (
              <>
                <Link href="/admin/blog">{t('admin')}</Link>
                <button onClick={() => signOut({ callbackUrl: '/' })} className="text-gray-500 hover:text-black">{t('logout')}</button>
              </>
            ) : (
              <Link href="/login">{t('login')}</Link>
            )}
          </div>
          <button onClick={toggle} className="border rounded px-2 py-0.5 text-xs hover:bg-gray-100 transition-colors">
            {locale === 'en' ? '中文' : 'EN'}
          </button>
          {/* Hamburger */}
          <button onClick={() => setOpen(o => !o)} className="sm:hidden p-1 -mr-1" aria-label="Menu">
            {open
              ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="sm:hidden border-t mt-3 pt-3 pb-1 flex flex-col gap-4 text-sm">
          <Link href="/blog" onClick={close}>{t('blog')}</Link>
          <Link href="/tools" onClick={close}>{t('tools')}</Link>
          <Link href="/files" onClick={close}>{t('files')}</Link>
          {session ? (
            <>
              <Link href="/admin/blog" onClick={close}>{t('admin')}</Link>
              <button onClick={() => { signOut({ callbackUrl: '/' }); close(); }} className="text-left text-gray-500">{t('logout')}</button>
            </>
          ) : (
            <Link href="/login" onClick={close}>{t('login')}</Link>
          )}
        </div>
      )}
    </nav>
  );
}
