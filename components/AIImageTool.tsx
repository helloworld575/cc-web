'use client';
import { useState } from 'react';
import { useLocale } from '@/components/useLocale';

export default function AIImageTool() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState('');
  const [revisedPrompt, setRevisedPrompt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLocale();

  async function readErrorResponse(response: Response) {
    try {
      const data = await response.clone().json();
      const detail = typeof data?.detail === 'string' && data.detail.trim()
        ? ` ${data.detail.trim()}`
        : '';
      if (typeof data?.error === 'string' && data.error.trim()) {
        return `${data.error}${detail}`;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text.trim()) return text.trim();
    }
    return `HTTP ${response.status}`;
  }

  async function generate() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError('');
    setImage('');
    setRevisedPrompt('');

    try {
      const response = await fetch('/api/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        setError(await readErrorResponse(response));
        return;
      }
      const data = await response.json();
      setImage(data.image);
      setRevisedPrompt(data.revised_prompt || '');
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setError(errorLike.message || t('imageFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('imageLab')}</p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">{t('imageTitle')}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {t('imageDesc')}
        </p>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('imagePrompt')}</span>
          <textarea
            data-testid="ai-image-prompt"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={6}
            placeholder={t('imagePromptPlaceholder')}
            className="w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </label>

        <button
          data-testid="ai-image-generate"
          type="button"
          onClick={generate}
          disabled={!prompt.trim() || loading}
          className="mt-4 w-full rounded-[22px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? t('imageGenerating') : t('imageGenerate')}
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {revisedPrompt && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
            {revisedPrompt}
          </div>
        )}
      </aside>

      <section className="flex min-h-[560px] items-center justify-center overflow-hidden rounded-[28px] border border-white/70 bg-slate-950 p-4 shadow-sm">
        {image ? (
          <img
            data-testid="ai-image-result"
            src={image}
            alt={prompt}
            className="max-h-[680px] w-full rounded-[22px] object-contain shadow-2xl"
          />
        ) : (
          <div className="max-w-sm text-center text-white/70">
            <p className="font-display text-3xl text-white">{t('imageReady')}</p>
            <p className="mt-3 text-sm leading-7">{t('imageReadyDesc')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
