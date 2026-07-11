'use client';
import { useEffect, useState } from 'react';
import { useLocale } from '@/components/useLocale';

interface Provider {
  id: number;
  name: string;
  api_type: 'openai' | 'anthropic';
  api_url: string;
  api_key: string;
  model: string;
  max_tokens: number;
  is_default: number;
  source?: 'env' | 'db';
}

export default function AdminAIConfigPage() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({});

  async function loadProviders() {
    setLoading(true);
    const res = await fetch('/api/ai-providers');
    if (res.ok) setProviders(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    loadProviders().catch(() => setLoading(false));
  }, []);

  async function testProvider(providerId: number) {
    setTestingId(providerId);
    setTestResult(current => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });

    try {
      const res = await fetch('/api/ai-providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId }),
      });
      const data = await res.json();
      setTestResult(current => ({
        ...current,
        [providerId]: {
          ok: Boolean(data.ok),
          msg: data.ok ? `${data.model}: ${data.text}` : data.error || t('adminAiProviderTestFailed'),
        },
      }));
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setTestResult(current => ({
        ...current,
        [providerId]: { ok: false, msg: errorLike?.message || t('adminAiProviderConnectionFailed') },
      }));
    } finally {
      setTestingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('adminAiProvidersEyebrow')}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{t('adminAiProvidersTitle')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {t('adminAiProvidersDesc')}
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
          {t('adminAiProvidersLoading')}
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm leading-6 text-amber-800">
          {t('adminAiProvidersEmpty')}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(provider => {
            const result = testResult[provider.id];
            return (
              <div key={provider.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{provider.name}</span>
                      {provider.is_default ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">{t('adminAiProviderDefault')}</span>
                      ) : null}
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">env.local</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-1 font-mono">{provider.api_type}</span>{' '}
                      <span className="font-mono">{provider.model}</span>
                      <span className="ml-2 text-slate-400">{provider.max_tokens} {t('adminAiProviderMaxTokens')}</span>
                    </p>
                    <p className="mt-1 truncate font-mono text-xs text-slate-400">{provider.api_url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => testProvider(provider.id)}
                    disabled={testingId !== null}
                    className="rounded border border-sky-300 px-3 py-1 text-sm text-sky-700 transition hover:bg-sky-50 disabled:opacity-50"
                  >
                    {testingId === provider.id ? t('adminAiProviderTesting') : t('adminAiProviderTest')}
                  </button>
                </div>
                {result && (
                  <div className={`mt-3 rounded px-3 py-2 text-xs ${result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {result.msg}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
