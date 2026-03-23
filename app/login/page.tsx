'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/components/useLocale';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useLocale();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await signIn('credentials', { password, redirect: false });
    if (res?.ok) router.push('/admin/blog');
    else setError(t('loginError'));
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
        <input
          type="password"
          placeholder={t('passwordPlaceholder')}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="bg-black text-white rounded px-4 py-2">
          {t('loginBtn')}
        </button>
      </form>
    </main>
  );
}
