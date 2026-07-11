'use client';

import Link from 'next/link';
import { useLocale } from '@/components/useLocale';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">404</p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-950">{t('notFoundTitle')}</h1>
      <p className="mt-4 max-w-md text-sm leading-7 text-slate-600">
        {t('notFoundDesc')}
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {t('backHome')}
      </Link>
    </main>
  );
}
