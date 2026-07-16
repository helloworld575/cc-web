'use client';
import Link from 'next/link';
import { startTransition, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useLocale } from '@/components/useLocale';
import { useTheme } from '@/components/ThemeProvider';

export default function Nav() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { theme, ready: themeReady, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const close = () => setOpen(false);
  const isAuthenticated = mounted && status === 'authenticated' && Boolean(session);
  const isLoadingSession = mounted && status === 'loading';
  const switchLocale = () => {
    setLocale(locale === 'en' ? 'zh' : 'en');
    close();
    startTransition(() => {
      router.refresh();
    });
  };
  const themeLabel = theme === 'dark' ? t('themeLightMode') : t('themeDarkMode');

  return (
    <nav className="relative z-50 border-b bg-white/85 px-4 py-3 backdrop-blur" suppressHydrationWarning>
      <div className="flex items-center gap-5 text-sm" suppressHydrationWarning>
        <Link href="/" className="font-bold flex items-center gap-1.5" onClick={close}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#111"/>
            <text x="16" y="22" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="bold" fontFamily="system-ui">T</text>
          </svg>
          ThomasLee
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex gap-5 items-center" suppressHydrationWarning>
          <Link href="/blog" suppressHydrationWarning>{t('blog')}</Link>
          <Link href="/tools" data-testid="nav-desktop-tools" suppressHydrationWarning>{t('tools')}</Link>
          <Link href="/files" suppressHydrationWarning>{t('files')}</Link>
        </div>

        <div className="ml-auto flex gap-3 items-center" suppressHydrationWarning>
          <div className="hidden sm:flex gap-4 items-center" suppressHydrationWarning>
            {isAuthenticated ? (
              <>
                <Link
                  href="/admin/blog"
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  suppressHydrationWarning
                >
                  {t('admin')}
                </Link>
                <button onClick={() => signOut({ callbackUrl: '/' })} className="text-gray-500 hover:text-black" suppressHydrationWarning>{t('logout')}</button>
              </>
            ) : mounted ? (
              <Link href="/login" suppressHydrationWarning>{t('login')}</Link>
            ) : null}
            {isLoadingSession && (
              <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                …
              </span>
            )}
          </div>
          <button type="button" data-testid="locale-toggle" onClick={switchLocale} className="border rounded px-2 py-0.5 text-xs hover:bg-gray-100 transition-colors" suppressHydrationWarning>
            {locale === 'en' ? '中文' : 'EN'}
          </button>
          <button
            type="button"
            data-testid="theme-toggle"
            aria-label={themeLabel}
            onClick={toggleTheme}
            disabled={!themeReady}
            className="hidden items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 sm:inline-flex"
            suppressHydrationWarning
          >
            <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
            <span>{themeLabel}</span>
          </button>
          {/* Hamburger */}
          <button type="button" onClick={() => setOpen(o => !o)} className="sm:hidden p-1 -mr-1" aria-label="Menu">
            {open
              ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="relative z-50 -mx-4 mt-3 flex flex-col gap-1 border-t bg-white/95 px-4 pb-2 pt-3 text-sm shadow-sm sm:hidden">
          <Link href="/blog" onClick={close} className="block rounded-lg px-2 py-2 hover:bg-slate-100">{t('blog')}</Link>
          <Link href="/tools" data-testid="nav-mobile-tools" onClick={close} className="block rounded-lg px-2 py-2 hover:bg-slate-100">{t('tools')}</Link>
          <Link href="/files" onClick={close} className="block rounded-lg px-2 py-2 hover:bg-slate-100">{t('files')}</Link>
          {isAuthenticated ? (
            <>
              <Link href="/admin/blog" onClick={close} className="block rounded-lg px-2 py-2 hover:bg-slate-100">{t('admin')}</Link>
              <button type="button" onClick={() => { signOut({ callbackUrl: '/' }); close(); }} className="rounded-lg px-2 py-2 text-left text-gray-500 hover:bg-slate-100">{t('logout')}</button>
            </>
          ) : (
            <Link href="/login" onClick={close} className="block rounded-lg px-2 py-2 hover:bg-slate-100">{t('login')}</Link>
          )}
          <button
            type="button"
            data-testid="nav-mobile-theme-toggle"
            onClick={toggleTheme}
            disabled={!themeReady}
            className="rounded-lg px-2 py-2 text-left text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            suppressHydrationWarning
          >
            {themeLabel}
          </button>
        </div>
      )}
    </nav>
  );
}
