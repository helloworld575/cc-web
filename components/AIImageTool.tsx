'use client';
import { useState } from 'react';

const SIZES = [
  { value: '1024x1024', label: 'Square' },
  { value: '1536x1024', label: 'Wide' },
  { value: '1024x1536', label: 'Tall' },
];

export default function AIImageTool() {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError('');
    setImage('');

    try {
      const response = await fetch('/api/ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || `HTTP ${response.status}`);
        return;
      }
      setImage(data.image);
    } catch (caught: unknown) {
      const errorLike = caught as { message?: string };
      setError(errorLike.message || 'Failed to generate image.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Image Lab</p>
        <h2 className="mt-2 font-display text-3xl text-slate-900">GPT Image</h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          Generate a quick visual using the configured gpt-image-2 endpoint.
        </p>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Prompt</span>
          <textarea
            data-testid="ai-image-prompt"
            value={prompt}
            onChange={event => setPrompt(event.target.value)}
            rows={6}
            placeholder="Describe the image you want"
            className="w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </label>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {SIZES.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSize(option.value)}
              className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition ${
                size === option.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          data-testid="ai-image-generate"
          type="button"
          onClick={generate}
          disabled={!prompt.trim() || loading}
          className="mt-4 w-full rounded-[22px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? 'Generating' : 'Generate'}
        </button>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
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
            <p className="font-display text-3xl text-white">Ready for a prompt</p>
            <p className="mt-3 text-sm leading-7">The generated image will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
