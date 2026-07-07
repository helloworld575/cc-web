'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useLocale } from '@/components/useLocale';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLocale();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError('');
    const res = await signIn('credentials', {
      password,
      redirect: false,
      callbackUrl: '/admin/blog',
    });

    if (res?.ok) {
      window.location.assign('/admin/blog');
      return;
    }

    setError(t('loginError'));
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
        <input
          data-testid="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="rounded border px-3 py-3 text-base"
          disabled={submitting}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          data-testid="login-submit"
          type="submit"
          disabled={submitting || !password}
          className="rounded bg-black px-4 py-3 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('loginBtn')}
        </button>
      </form>
    </main>
  );
}
